const FIELD_TYPES = new Set([
  "string",
  "number",
  "enum",
  "boolean",
  "stringList",
  "numberList",
]);

const isPlainObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value);

export function isSupportedField(field) {
  return Boolean(field) && FIELD_TYPES.has(field.type);
}

export function styleOf(engine, styleId) {
  const style = engine.styles?.[styleId];
  if (!style) throw new Error(`engine ${engine.id} 缺少 style：${styleId}`);
  return style;
}

export function fieldMap(engine, styleId) {
  return {
    ...(engine.shared ?? {}),
    ...(styleOf(engine, styleId).params ?? {}),
  };
}

export function defaultsFor(fields) {
  const out = {};
  for (const [key, field] of Object.entries(fields)) {
    if (field?.default !== undefined) out[key] = field.default;
  }
  return out;
}

function typeName(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export function checkFieldDefinition(key, field, location, errors) {
  if (!isPlainObject(field)) {
    errors.push(`${location}.${key} 参数声明必须是对象`);
    return;
  }
  if (!isSupportedField(field)) {
    errors.push(`${location}.${key} 类型未知：${field.type}`);
    return;
  }
  if (!field.label) errors.push(`${location}.${key} 缺少中文 label`);

  if (field.type === "number" || field.type === "enum") {
    const numbers = field.type === "enum" ? field.values : [field.default];
    if (field.type === "enum") {
      if (!Array.isArray(field.values) || !field.values.length) {
        errors.push(`${location}.${key} enum 缺少 values`);
      } else if (
        field.default !== undefined &&
        !field.values.includes(field.default)
      ) {
        errors.push(`${location}.${key} 默认值不在 values 内`);
      }
    } else if (field.default !== undefined && typeof field.default !== "number") {
      errors.push(`${location}.${key} 默认值必须是数字`);
    }
    if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
      errors.push(`${location}.${key} min 不能大于 max`);
    }
    if (
      field.type === "number" &&
      typeof field.default === "number" &&
      ((field.min !== undefined && field.default < field.min) ||
        (field.max !== undefined && field.default > field.max))
    ) {
      errors.push(`${location}.${key} 默认值超出范围`);
    }
    if (numbers && numbers.some((value) => typeof value !== "number") && field.type === "number") {
      errors.push(`${location}.${key} 默认值必须是数字`);
    }
  }
}

function checkValue(key, field, value, location, errors) {
  if (!isSupportedField(field)) return;
  if (field.type === "number") {
    if (typeName(value) !== "number" || !Number.isFinite(value)) {
      errors.push(`${location}.${key} 必须是数字`);
      return;
    }
    if (field.min !== undefined && value < field.min) {
      errors.push(`${location}.${key} 小于最小值 ${field.min}`);
    }
    if (field.max !== undefined && value > field.max) {
      errors.push(`${location}.${key} 大于最大值 ${field.max}`);
    }
  } else if (field.type === "enum") {
    if (!Array.isArray(field.values) || !field.values.includes(value)) {
      errors.push(`${location}.${key} 不在允许列表内：${JSON.stringify(value)}`);
    }
  } else if (field.type === "boolean") {
    if (typeof value !== "boolean") errors.push(`${location}.${key} 必须是布尔值`);
  } else if (field.type === "string") {
    if (typeof value !== "string") errors.push(`${location}.${key} 必须是字符串`);
  } else if (field.type === "stringList") {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
      errors.push(`${location}.${key} 必须是字符串数组`);
    } else if (field.minItems !== undefined && value.length < field.minItems) {
      errors.push(`${location}.${key} 至少需要 ${field.minItems} 项`);
    } else if (field.maxItems !== undefined && value.length > field.maxItems) {
      errors.push(`${location}.${key} 最多 ${field.maxItems} 项`);
    }
  } else if (field.type === "numberList") {
    if (
      !Array.isArray(value) ||
      value.some((item) => typeof item !== "number" || !Number.isFinite(item))
    ) {
      errors.push(`${location}.${key} 必须是数字数组`);
    }
  }
}

export function resolveParams({
  engine,
  styleId,
  layers = [],
  location = "params",
  errors = [],
  warnings = [],
}) {
  const style = styleOf(engine, styleId);
  const fields = fieldMap(engine, styleId);
  const props = { ...(style.defaults ?? {}), ...defaultsFor(fields) };

  for (const [index, layer] of layers.entries()) {
    if (layer === undefined || layer === null) continue;
    if (!isPlainObject(layer)) {
      errors.push(`${location}[${index}] 必须是对象`);
      continue;
    }
    for (const [key, value] of Object.entries(layer)) {
      if (key === "code") continue;
      const field = fields[key];
      if (!field) {
        errors.push(`${location}.${key} 未在引擎 ${engine.id} 的参数声明中登记`);
        continue;
      }
      checkValue(key, field, value, location, errors);
      props[key] = value;
    }
  }

  props.code = style.code;

  const keyword = props.keyword;
  if (typeof keyword === "string" && keyword && typeof props.text === "string") {
    if (!props.text.includes(keyword)) {
      warnings.push(
        `${location}.keyword「${keyword}」不在文案「${props.text}」中，高亮不会出现`,
      );
    }
  }

  return props;
}
