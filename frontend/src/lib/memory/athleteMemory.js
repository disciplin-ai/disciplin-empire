"use strict";

const fs = require("fs");
const path = require("path");

const VALID_MODULES = new Set(["vision", "sensei", "fuel"]);
const DEFAULT_MEMORY_FILE = path.join(__dirname, "athlete-memories.json");

function createAthleteMemory(options = {}) {
  const memoryFile =
    options.memoryFile ||
    process.env.ATHLETE_MEMORY_FILE ||
    DEFAULT_MEMORY_FILE;

  function readMemories() {
    if (!fs.existsSync(memoryFile)) {
      return [];
    }

    const raw = fs.readFileSync(memoryFile, "utf8").trim();
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Athlete memory store must contain an array.");
    }

    return parsed;
  }

  function writeMemories(memories) {
    fs.mkdirSync(path.dirname(memoryFile), { recursive: true });
    fs.writeFileSync(
      memoryFile,
      `${JSON.stringify(memories, null, 2)}\n`,
      "utf8"
    );
  }

  function normalizeMemory(input) {
    if (!input || typeof input !== "object") {
      throw new Error("Memory must be an object.");
    }

    const { userId, module, type, content, metadata = {}, createdAt } = input;

    if (!userId || typeof userId !== "string") {
      throw new Error("Memory requires a string userId.");
    }

    if (!VALID_MODULES.has(module)) {
      throw new Error("Memory module must be one of: vision, sensei, fuel.");
    }

    if (!type || typeof type !== "string") {
      throw new Error("Memory requires a string type.");
    }

    if (content === undefined || content === null) {
      throw new Error("Memory requires content.");
    }

    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      throw new Error("Memory metadata must be an object.");
    }

    return {
      userId,
      module,
      type,
      content,
      metadata,
      createdAt: createdAt || new Date().toISOString(),
    };
  }

  function filterMemories(filters = {}) {
    return readMemories().filter((memory) => {
      if (filters.userId && memory.userId !== filters.userId) {
        return false;
      }

      if (filters.module && memory.module !== filters.module) {
        return false;
      }

      if (filters.type && memory.type !== filters.type) {
        return false;
      }

      return true;
    });
  }

  function byNewestFirst(left, right) {
    return (
      new Date(right.createdAt).getTime() -
      new Date(left.createdAt).getTime()
    );
  }

  function saveMemory(memory) {
    const normalized = normalizeMemory(memory);
    const memories = readMemories();

    memories.push(normalized);
    writeMemories(memories);

    return normalized;
  }

  function getRecentMemories(filters = {}) {
    const limit =
      Number.isInteger(filters.limit) && filters.limit > 0
        ? filters.limit
        : 20;

    return filterMemories(filters).sort(byNewestFirst).slice(0, limit);
  }

  function getMemoriesByType(userId, type, filters = {}) {
    return filterMemories({
      ...filters,
      userId,
      type,
    }).sort(byNewestFirst);
  }

  function getOccurrenceCount(userId, type, filters = {}) {
    return filterMemories({
      ...filters,
      userId,
      type,
    }).length;
  }

  function getLatestMemory(userId, type, filters = {}) {
    return getMemoriesByType(userId, type, filters)[0] || null;
  }

  return {
    saveMemory,
    getRecentMemories,
    getMemoriesByType,
    getOccurrenceCount,
    getLatestMemory,
  };
}

module.exports = {
  createAthleteMemory,
  ...createAthleteMemory(),
};