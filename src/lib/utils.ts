import { ObjectId } from "mongodb";

export function toObjectId(id: string, field = "id"): ObjectId {
  if (!ObjectId.isValid(id)) {
    throw new Error(`Invalid ${field}`);
  }
  return new ObjectId(id);
}

export function serialize<T>(doc: T): T {
  return JSON.parse(
    JSON.stringify(doc, (_key, value) => {
      if (value instanceof ObjectId) return value.toString();
      if (value instanceof Date) return value.toISOString();
      return value;
    })
  );
}
