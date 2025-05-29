const remote = require("@electron/remote");
const path = require("path");

const fs = require("fs");
const hexDictionary = new Map(require("./dictionary.json", "utf8"));
const statOrder = [
  "health",
  "resolve",
  "fatigue",
  "meleeSkill",
  "rangedSkill",
  "meleeDefense",
  "rangedDefense",
  "initiative",
];
const talent = [
  { name: "Health", min: 2, max: 4 },
  { name: "Resolve", min: 2, max: 4 },
  { name: "Fatigue", min: 2, max: 4 },
  { name: "Initiative", min: 3, max: 5 },
  { name: "MeleeSkill", min: 1, max: 3 },
  { name: "RangedSkill", min: 2, max: 4 },
  { name: "MeleeDefense", min: 1, max: 3 },
  { name: "RangedDefense", min: 2, max: 4 },
];

//this is kept for historical reasons
const specialEvents = [
  "6469736f776e65645f6e6f626c655f72656d696e6973636573",
  "4465766f75726564",
  "7371756972655f76735f68656467655f6b6e69676874",
  "4973436f6e63657074696f6e4f664d6f6e6579546573746564",
];

const quantityHex = "0000803F";
const SlotNames = [
  "weapon",
  "shield",
  "body",
  "helmet",
  "trinket",
  "quiver",
  "pouch",
];

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function toBytes(value, useBuffer = "") {
  if (useBuffer === "utf8" || useBuffer === "ascii") {
    return Buffer.from(value, useBuffer).toString("hex");
  }
  if (useBuffer === "string") {
    let str = toBytes(value, "utf8");
    let l = toBytes(str.length / 2, "writeUInt16LE");

    return l + str;
  }
  if (useBuffer === "writeFloatLE" || useBuffer === "writeUInt32LE") {
    let buf = Buffer.alloc(4);
    buf[useBuffer](value, 0);
    return buf.toString("hex");
  }
  if (useBuffer.includes("Int16")) {
    let buf = Buffer.alloc(2);
    buf[useBuffer](value, 0);
    return buf.toString("hex");
  }
  if (useBuffer === "writeInt8" || useBuffer === "writeUInt8") {
    let buf = Buffer.alloc(1);
    buf[useBuffer](value, 0);
    return buf.toString("hex");
  }
  return value.toString(16);
}

const erasureExceptions = ["pos", "origin"];

function eraseItem(item) {
  let props = Object.keys(item);
  for (var i = 0; i < props.length; i++)
    if (!erasureExceptions.includes(props[i])) delete item[props[i]];
}

function getSubstring(string, start, length) {
  return string.substring(start, start + length);
}

function getInterface() {
  let keys = Object.keys(window);
  for (var i = keys.length - 1; i >= 0; i--)
    if (window[keys[i]] instanceof Interface) return window[keys[i]];
}

const ItemValueRandomizer = {
  pick: (pool, item, count) => {
    for (let c = 0; c < count; c++) {
      let i = getRandomInt(0, pool.length - 1);

      if (pool[i][0] === "damageMult") {
        item.damageMin = Math.round(item.damageMin * pool[i][1] * 0.01);
        item.damageMax = Math.round(item.damageMax * pool[i][1] * 0.01);
      } else item[pool[i][0]] = pool[i][1];

      pool.splice(i, 1);
    }
  },

  namedArmor: (item) => {
    item.durability = Math.floor(
      item.durability * getRandomInt(110, 125) * 0.01
    );
    item.fatigue = Math.min(-8, item.fatigue + getRandomInt(3, 9));
  },

  namedHelmet: (item) => {
    item.durability = Math.floor(
      item.durability * getRandomInt(110, 125) * 0.01
    );
    item.fatigue = Math.min(-4, item.fatigue + getRandomInt(1, 4));
  },

  namedShield: (item) => {
    let pool = [];
    let record = hexDictionary.get(item.id);

    pool.push(["mDef", Math.floor(item.mDef * getRandomInt(120, 140) * 0.01)]);
    pool.push(["rDef", Math.floor(item.rDef * getRandomInt(120, 140) * 0.01)]);
    pool.push([
      "fatigue",
      Math.floor(item.fatigue * getRandomInt(70, 90) * 0.01),
    ]);
    pool.push(["fatigueUse", record.fatigueUse - getRandomInt(1, 3)]);
    pool.push([
      "durability",
      Math.floor(item.durability * getRandomInt(120, 160) * 0.01),
    ]);

    ItemValueRandomizer.pick(pool, item, 2);
  },

  namedWeapon: (item) => {
    let pool = [];

    if (item.durability > 1)
      item.durability = Math.floor(
        item.durability * getRandomInt(90, 140) * 0.01
      );

    pool.push(["damageMult", getRandomInt(110, 130)]);
    pool.push(["damageArmor", item.damageArmor + getRandomInt(10, 30) * 0.01]);
    pool.push(["penetration", item.penetration + getRandomInt(8, 16) * 0.01]);
    pool.push(["fatigueUse", item.fatigueUse - getRandomInt(1, 3)]);

    if (item.headChance)
      pool.push(["headChance", item.headChance + getRandomInt(10, 20)]);

    if (item.fatigue <= -10)
      pool.push([
        "fatigue",
        Math.round(item.fatigue * getRandomInt(50, 80) * 0.01),
      ]);

    if (item.damageShield >= 16)
      pool.push([
        "damageShield",
        Math.round(item.damageShield * getRandomInt(133, 180) * 0.01),
      ]);

    if (item.ammoMax) pool.push(["ammo", item.ammoMax + getRandomInt(1, 3)]);

    if (item.hitBonus || item.subType === "ranged")
      pool.push(["hitBonus", item.hitBonus + getRandomInt(5, 15)]);

    ItemValueRandomizer.pick(pool, item, 2);
  },
};

const blank = {
  genericWeapon: {
    id: "AAB1F04F",
    type: "genericWeapon",
    durability: 999,
    repair: "00",
    icon: 1,
    ammo: 0,
  },
  namedWeapon: {
    id: "3A0711AF",
    type: "namedWeapon",
    name: "Named Weapon",
    maxDurability: 50,
    durability: 50,
    fatigue: 0,
    fatigueUse: 0,
    damageMin: 20,
    damageMax: 40,
    damageArmor: 0.7,
    headChance: 0,
    damageShield: 0,
    hitBonus: 0,
    penetration: 0,
    repair: "00",
    icon: 1,
    ammo: 0,
    ammoMax: 0,
  },
  genericShield: {
    id: "DC2F4731",
    type: "genericShield",
    durability: 999,
    repair: "00",
    icon: 1,
  },
  namedShield: {
    id: "A9B08AB4",
    type: "namedShield",
    name: "Named Kite Shield",
    maxDurability: 48,
    durability: 48,
    fatigue: 0,
    fatigueUse: 0,
    repair: "00",
    icon: 1,
    mDef: 15,
    rDef: 25,
  },
  genericArmor: {
    id: "95EC7AD9",
    type: "genericArmor",
    durability: 115,
    attachment: "00000000",
    baseDurability: 115,
    baseFatigue: -12,
    repair: "00",
    icon: 26,
    fatigue: -12,
  },
  genericHelmet: {
    id: "2264175D",
    type: "genericArmor",
    durability: 105,
    repair: "00",
    icon: 1,
  },
  namedArmor: {
    id: "A6C30FC8",
    type: "namedArmor",
    name: "Reinforced Mail Shirt",
    maxDurability: 200,
    durability: 200,
    fatigue: -15,
    attachment: "00000000",
    baseDurability: 200,
    baseFatigue: -15,
    repair: "00",
    icon: 46,
  },
  namedHelmet: {
    id: "4AD28101",
    type: "namedArmor",
    name: "Norse Nasal Helmet",
    maxDurability: 200,
    durability: 200,
    fatigue: -10,
    repair: "00",
    icon: 52,
  },
  auxiliary: {
    id: "6A2830C4",
    type: "auxiliary",
    durability: 1,
    repair: "00",
    icon: 1,
  },
  attachment: {
    id: "76B57B86",
    type: "attachment",
    slot: "attachment",
    durability: 0,
    fatigue: 0,
  },
};

//didn't feel like making these static classes, don't judge me, I'm a free man
const Forge = {
  attachment: (entity, item) => {
    //body armor (slot 2) attachment check
    if (hexDictionary.get(item.id).slot === "body") {
      item.attachment = entity.readBytes(4).toUpperCase();
      if (item.attachment !== "00000000") {
        entity.readOffset += 2; //skip repair
        item.attachmentIcon = entity.readBytes(2, true, "readUInt16LE");
        entity.readOffset += 18; // two quanityHexes and magicNumber
        entity.readOffset += 4; // skip padding bytes after magicNumber (introduced in 1.5.1)
        item.baseDurability = entity.readBytes(4, true, "readFloatLE");
        item.baseFatigue = entity.readBytes(2, true, "readInt16LE");
      }
    } else if (item.type === "attachment") {
      entity.readOffset += 2;
      item.icon = entity.readBytes(2, true, "readUInt16LE");
      entity.readOffset += 30; //skip two quantityHexes, durability, fatigue and magic number
      entity.readOffset += 4; // skip padding bytes after magicNumber (introduced in 1.5.1)
    }
  },
  bodyArmorStats: (entity, item) => {
    item.fatigue = entity.readBytes(4, true, "readFloatLE");

    if (item.baseFatigue === undefined) {
      if (item.type === "genericArmor") {
        item.baseFatigue = hexDictionary.get(item.id).fatigue;
        item.baseDurability = hexDictionary.get(item.id).durability;
      } else {
        item.baseFatigue = item.fatigue;
        item.baseDurability = item.maxDurability;
      }
    }
  },
  generic: (entity, item) => {
    item.repair = entity.readBytes(1);
    item.icon = entity.readBytes(2, true, "readUInt16LE");
    item.durability = entity.readBytes(4, true, "readFloatLE");
    entity.readOffset += 8; //one quantityHex
    item.magicNumber = entity.readBytes(1, true);
    entity.readOffset += 4; // skip padding bytes after magicNumber (introduced in 1.5.1)
  },
  genericWeapon: (entity, item) => {
    Forge.generic(entity, item);
    item.ammo = entity.readBytes(2, true, "readUInt16LE");
    if (hexDictionary.get(item.id).subType !== "masterworkBow") return;

    item.name = entity.readBytes("string");
  },
  genericShield: (entity, item) => {
    Forge.generic(entity, item);
    if (hexDictionary.get(item.id).subType === "nobleShield")
      item.house = entity.readBytes(1, true);
  },
  genericArmor: (entity, item) => {
    if (hexDictionary.get(item.id).subType === "nobleArmor")
      item.house = entity.readBytes(1, true);

    if (hexDictionary.get(item.id).slot === "body")
      Forge.attachment(entity, item);

    Forge.generic(entity, item);
    item.durability = entity.readBytes(4, true, "readFloatLE");

    //body armor (slot 2) additional values
    if (hexDictionary.get(item.id).slot === "body")
      Forge.bodyArmorStats(entity, item);

    if (hexDictionary.get(item.id).subType !== "davkul") return;

    item.description = entity.readBytes("string");
  },
  genericHelmet: (entity, item) => {
    Forge.genericArmor(entity, item);
  },
  namedWeapon: (entity, item) => {
    item.name = entity.readBytes("string"); //Name
    item.maxDurability = entity.readBytes(4, true, "readFloatLE"); //ConditionMax
    item.fatigue = entity.readBytes(1, true, "readInt8"); //StaminaModifier
    item.damageMin = entity.readBytes(2, true, "readUInt16LE"); //RegularDamage
    item.damageMax = entity.readBytes(2, true, "readUInt16LE"); //RegularDamageMax
    item.damageArmor = entity.readBytes(4, true, "readFloatLE"); //ArmorDamageMult
    item.headChance = entity.readBytes(1, true); //ChanceToHitHead
    item.damageShield = entity.readBytes(2, true, "readUInt16LE"); //ShieldDamage
    item.hitBonus = entity.readBytes(2, true, "readUInt16LE"); //AdditionalAccuracy
    item.penetration = entity.readBytes(4, true, "readFloatLE"); //DirectDamageAdd
    item.fatigueUse = entity.readBytes(2, true, "readInt16LE"); //FatigueOnSkillUse
    item.ammoMax = entity.readBytes(2, true, "readInt16LE"); //AmmoMax
    entity.readOffset += 8; //zero float
    Forge.genericWeapon(entity, item);
  },
  namedArmor: (entity, item) => {
    item.name = entity.readBytes("string");
    item.maxDurability = entity.readBytes(4, true, "readFloatLE");
    item.fatigue = entity.readBytes(1, true, "readInt8");

    Forge.genericArmor(entity, item);
  },
  namedHelmet: (entity, item) => {
    Forge.namedArmor(entity, item);
  },
  namedShield: (entity, item) => {
    item.maxDurability = entity.readBytes(4, true, "readFloatLE");
    Forge.genericShield(entity, item);
    item.name = entity.readBytes("string");
    item.fatigue = entity.readBytes(1, true, "readInt8");
    item.mDef = entity.readBytes(2, true, "readUInt16LE");
    item.rDef = entity.readBytes(2, true, "readUInt16LE");
    item.fatigueUse = entity.readBytes(2, true, "readInt16LE");
  },
  auxiliary: (entity, item) => {
    Forge.generic(entity, item);

    let subType = hexDictionary.get(item.id).subType;

    if (subType === "ammo") {
      item.ammo = entity.readBytes(2, true, "readUInt16LE");
    } else if (subType === "canine") {
      item.name = entity.readBytes("string");
    } else if (subType === "provisions") {
      item.amount = entity.readBytes(4, true, "readFloatLE");
      item.expiry = entity.readBytes(4, true, "readFloatLE");
      item.bought = entity.readBytes(2, true, "readInt16LE");
    } else if (subType === "commodity")
      item.bought = entity.readBytes(2, true, "readInt16LE");
  },
};

const Meltdown = {
  attachment: (item) => {
    let itemHex = "";

    //body armor (slot 2) attachment
    if (hexDictionary.get(item.id).slot === "body") {
      itemHex += item.attachment;
      if (item.attachment !== "00000000") {
        itemHex += "00";
        itemHex += toBytes(item.attachmentIcon, "writeUInt16LE");
        itemHex += quantityHex.repeat(2) + "64"; //tacking on a magicNumber for the lulz
        itemHex += "0000"; //add padding bytes after magicNumber (introduced in 1.5.1)

        if (item.type == "genericArmor") {
          itemHex += toBytes(
            hexDictionary.get(item.id).durability,
            "writeFloatLE"
          );
          itemHex += toBytes(
            hexDictionary.get(item.id).fatigue,
            "writeInt16LE"
          );
        } else {
          itemHex += toBytes(item.baseDurability, "writeFloatLE");
          itemHex += toBytes(item.baseFatigue, "writeInt16LE");
        }
      }
    } else if (item.type === "attachment") {
      itemHex += "0" + item.slot + item.id;
      itemHex +=
        "00" +
        toBytes(item.icon, "writeUInt16LE") +
        quantityHex.repeat(2) +
        "64000000000000"; //repair(1), icon(2), quantityHex(8), durability (6), fatigue (2), magicNumber (1)
      itemHex += "0000"; //add padding bytes after magicNumber (introduced in 1.5.1)
    }

    return itemHex;
  },
  generic: (item, makeHeader = true) => {
    let itemHex = "";

    if (makeHeader) {
      itemHex += "0" + item.slot;
      itemHex += item.id;
    }

    itemHex += item.repair;
    itemHex += toBytes(item.icon, "writeUInt16LE");
    itemHex += toBytes(item.durability || 1, "writeFloatLE");
    itemHex += quantityHex;
    itemHex += toBytes(item.magicNumber || 99, "writeUInt8");
    itemHex += "0000"; //add padding bytes after magicNumber (introduced in 1.5.1)
    return itemHex;
  },
  genericWeapon: (item, makeHeader) => {
    let itemHex = Meltdown.generic(item, makeHeader);
    itemHex += toBytes(item.ammo, "writeUInt16LE");
    if (hexDictionary.get(item.id).subType !== "masterworkBow") return itemHex;

    itemHex += toBytes(item.name, "string");

    return itemHex;
  },
  genericShield: (item, makeHeader) => {
    let itemHex = Meltdown.generic(item, makeHeader);
    if (hexDictionary.get(item.id).subType === "nobleShield")
      itemHex += item.house ? toBytes(item.house, "writeUInt8") : "01";

    return itemHex;
  },
  genericArmor: (item, makeHeader = true) => {
    let itemHex = "";

    if (makeHeader) {
      itemHex += "0" + item.slot;
      itemHex += item.id;
    }

    if (hexDictionary.get(item.id).subType === "nobleArmor")
      itemHex += item.house ? toBytes(item.house, "writeUInt8") : "01";

    if (hexDictionary.get(item.id).slot === "body")
      itemHex += Meltdown.attachment(item);

    itemHex += Meltdown.generic(item, false);

    itemHex += toBytes(item.durability, "writeFloatLE");

    if (hexDictionary.get(item.id).slot === "body")
      itemHex += toBytes(item.fatigue, "writeFloatLE");

    if (hexDictionary.get(item.id).subType !== "davkul") return itemHex;

    itemHex += toBytes(item.description, "string");

    return itemHex;
  },
  genericHelmet: (item) => {
    return Meltdown.genericArmor(item);
  },
  namedWeapon: (item) => {
    let itemHex = "";
    itemHex += "0" + item.slot;
    itemHex += item.id;
    itemHex += toBytes(item.name, "string");
    itemHex += toBytes(item.maxDurability || item.durability, "writeFloatLE");
    itemHex += toBytes(item.fatigue, "writeInt8");
    itemHex += toBytes(item.damageMin, "writeUInt16LE");
    itemHex += toBytes(item.damageMax, "writeUInt16LE");
    itemHex += toBytes(item.damageArmor, "writeFloatLE");
    itemHex += toBytes(item.headChance, "writeUInt8");
    itemHex += toBytes(item.damageShield, "writeUInt16LE");
    itemHex += toBytes(item.hitBonus, "writeUInt16LE");
    itemHex += toBytes(item.penetration, "writeFloatLE");
    itemHex += toBytes(item.fatigueUse, "writeInt16LE");
    itemHex += toBytes(item.ammo, "writeInt16LE") + "00000000"; //ammoMax
    itemHex += Meltdown.genericWeapon(item, false);
    return itemHex;
  },
  namedArmor: (item) => {
    let itemHex = "";
    itemHex += "0" + item.slot;
    itemHex += item.id;
    itemHex += toBytes(item.name, "string");
    itemHex += toBytes(item.maxDurability || item.durability, "writeFloatLE");
    itemHex += toBytes(item.fatigue, "writeInt8");

    itemHex += Meltdown.genericArmor(item, false);

    return itemHex;
  },
  namedHelmet: (item) => {
    return Meltdown.namedArmor(item);
  },
  namedShield: (item) => {
    let itemHex = "";
    itemHex += "0" + item.slot;
    itemHex += item.id;
    itemHex += toBytes(item.maxDurability || item.durability, "writeFloatLE");

    itemHex += Meltdown.genericShield(item, false);

    itemHex += toBytes(item.name, "string");
    itemHex += toBytes(item.fatigue, "writeInt8");
    itemHex += toBytes(item.mDef, "writeUInt16LE");
    itemHex += toBytes(item.rDef, "writeUInt16LE");
    itemHex += toBytes(item.fatigueUse, "writeInt16LE");
    return itemHex;
  },
  auxiliary: (item) => {
    let itemHex = Meltdown.generic(item);

    let subType = hexDictionary.get(item.id).subType;
    if (subType === "ammo")
      itemHex += item.ammo ? toBytes(item.ammo, "writeUInt16LE") : "0000";

    if (subType === "canine") {
      itemHex += toBytes(item.name, "string");
    } else if (subType === "provisions") {
      itemHex += toBytes(item.amount, "writeFloatLE");
      itemHex += toBytes(item.expiry, "writeFloatLE");
      itemHex += toBytes(item.bought, "writeInt16LE");
    } else if (subType === "commodity")
      itemHex += toBytes(item.bought, "writeInt16LE");

    return itemHex;
  },
};

class Entity {
  constructor(offset) {
    this.offset = offset;
    this.readOffset = 0;
  }

  readBytes(amount, parsed = false, useBuffer = "") {
    if (amount === 0) return "";
    if (amount === "string") {
      amount = this.readBytes(2, true, "readUInt16LE");
      parsed = true;
      useBuffer = "utf8";
    }

    let result = getSubstring(
      saveData,
      this.offset + this.readOffset,
      amount * 2
    );
    this.readOffset += amount * 2;
    if (useBuffer === "utf8") {
      let tBuf = Buffer.from(result, "hex");
      return tBuf.toString("utf8");
    }
    if (
      useBuffer === "readFloatLE" ||
      useBuffer === "readUInt32LE" ||
      useBuffer === "readInt16LE" ||
      useBuffer === "readUInt16LE" ||
      useBuffer === "readInt8"
    ) {
      let buf = Buffer.from(result, "hex");
      return useBuffer === "readFloatLE"
        ? +buf[useBuffer](0).toFixed(2)
        : buf[useBuffer](0);
    }

    return parsed ? parseInt(result, 16) : result;
  }
}

class Item {
  constructor(parent) {
    Object.defineProperty(this, "inventory", {
      value: parent,
      configurable: false,
    });
  }

  get origin() {
    return this.inventory.origin;
  }

  get isEmpty() {
    return Object.keys(this).length === 0;
  }

  erase() {
    let keys = Object.keys(this);
    for (var i = 0; i < keys.length; i++) delete this[keys[i]];
  }

  assign(data) {
    if (!this.isEmpty) this.erase();

    Object.assign(this, data);
  }
}

class Inventory {
  constructor(origin, count, size) {
    this.origin = origin;
    this.items = count || 0;
    this.list = [];

    if (size) for (var i = 0; i < size; i++) this.push();
  }

  assign(index, data) {
    let item = this.list[index];
    if (!item.isEmpty) item.erase();

    Object.assign(item, data);
  }

  push(data) {
    let item = new Item(this);
    if (data) Object.assign(item, data);
    this.list.push(item);
  }

  pop() {
    return this.list.pop();
  }

  resize(size) {
    let difference = Math.abs(size - this.size);
    let direction = size > this.size;

    for (var i = 0; i < difference; i++) {
      if (direction) this.push();
      else {
        let item = this.pop();
        if (!item.isEmpty) this.items--;
      }
    }
  }

  get size() {
    return this.list.length;
  }
}

class battleBrother extends Entity {
  constructor(offset) {
    super(offset);

    let int0 = 0;
    let int1 = 0;

    int0 = this.readBytes(1, true); //visual layers count
    this.visualLayerMap = new Map();
    for (var i = 0; i < int0; i++) {
      this.visualLayerMap.set(this.readBytes("string"), {
        value: this.readBytes(12).toUpperCase(),
        separator: this.readBytes(53),
      });
    }

    let headerStart = this.readOffset;
    int0 = this.readBytes(2, true, "readInt16LE"); //header member count

    for (var i = 0; i < int0; i++) {
      let memberLength = this.readBytes(2, true, "readInt16LE");
      let memberName = this.readBytes(memberLength);
      let memberType = this.readBytes(1);
      this.readOffset += memberType === "02" ? 2 : 8;
    }

    this.header = getSubstring(
      saveData,
      this.offset + headerStart,
      this.readOffset - headerStart
    );

    this.actionPoints = this.readBytes(1, true);
    for (var i = 0; i < 8; i++) {
      this[statOrder[i]] = this.readBytes(2, true, "readInt16LE");
    }

    this.greedAndGluttony = this.readBytes(6); //bonus pay and food consumption
    this.pouches = this.readBytes(1, true);

    this.inventory = new Inventory("brother", this.readBytes(1, true), 6);

    for (var i = 0; i < this.inventory.items; i++) {
      let item = {};
      item.slot = this.readBytes(1, true);
      item.id = this.readBytes(4).toUpperCase();

      if (!hexDictionary.has(item.id)) {
        getInterface().displayWarning(
          "UNKNOWN",
          "Unknown item equipped! slot: " +
            SlotNames[item.slot] +
            " | id: " +
            item.id
        );
      }

      item.type = hexDictionary.get(item.id).type;
      Forge[item.type](this, item);

      if (item.slot === 6) this.inventory.push(item);
      else this.inventory.assign(item.slot, item);
    }

    this.inventory.resize(6 + this.pouches);

    this.perks = [];
    this.background = "";
    int1 = this.readBytes(2, true, "readUInt16LE");
    for (var i = 0; i < int1; i++) {
      let circleHex = this.readBytes(4).toUpperCase();

      this.readOffset += 2; //skip isNew byte for skill serialization

      if (!hexDictionary.has(circleHex))
        getInterface().displayWarning(
          "UNKNOWN",
          "Found an unknown trait or background: " + circleHex
        );

      if (hexDictionary.get(circleHex).type === "background") {
        this.background = circleHex;
        break;
      }

      this.perks.push(circleHex);
    }

    this.description = this.readBytes("string");
    this.descriptionTemplate = this.readBytes("string");
    this.unknown = this.readBytes(2); //unknown bytes
    this.salaryMultiplier = this.readBytes(4, true, "readFloatLE");
    if (this.background === "6DF381C6" || this.background === "CB90AA90")
      //wildman and barbarian tattoo byte
      this.tattoo = this.readBytes(1);

    this.traits = [];
    for (var i = this.perks.length + 1; i < int1; i++) {
      let trait = {};
      trait.id = this.readBytes(4).toUpperCase();

      if (!hexDictionary.has(trait.id))
        getInterface().displayWarning("UNKNOWN", "Unknown trait: " + trait.id);

      if (hexDictionary.get(trait.id).type !== "injury") this.readOffset += 2; //accomodating "isNew" property of some traits

      if (hexDictionary.get(trait.id).type === "injury")
        trait.event = this.readBytes(14);
      if (hexDictionary.get(trait.id).type === "training")
        trait.event = this.readBytes(37);
      if (hexDictionary.get(trait.id).type === "knowledge")
        trait.event = this.readBytes(12);
      if (hexDictionary.get(trait.id).type === "learning")
        trait.event = this.readBytes(2);

      this.traits.push(trait);
    }

    this.traits = this.traits.filter((trait) => {
      if (hexDictionary.get(trait.id).type === "perk") {
        this.perks.push(trait.id);
        return false;
      }
      return true;
    });

    this.name = this.readBytes("string");
    this.title = this.readBytes("string");
    this.lightWound = this.readBytes(4, true, "readFloatLE");
    this.experience = this.readBytes(4, true, "readUInt32LE");

    this.humanBytes = this.readBytes(6); //stuff added by human class and inheritors

    this.levelTotal = this.readBytes(1, true);
    this.perkPoints = this.readBytes(1, true);
    this.perkUsed = this.readBytes(1, true);
    this.levelPoints = this.readBytes(1, true);
    this.morale = this.readBytes(4, true, "readFloatLE");

    this.moraleModifierHex = this.readBytes(1);
    int1 = parseInt(this.moraleModifierHex, 16);
    for (var i = 0; i < int1; i++) {
      this.moraleModifierHex += this.readBytes(1);
      let textLength = this.readBytes(2, true, "readUInt16LE");
      this.moraleModifierHex += toBytes(textLength, "writeUInt16LE");
      this.moraleModifierHex += this.readBytes(textLength + 4);
    }
    this.moraleModifierHex += this.readBytes(8);

    for (var i = 0; i < 8; i++)
      this["star" + talent[i].name] = this.readBytes(1, true);

    for (var i = 0; i < 8; i++) {
      this.talentPoints = this.readBytes(1, true);
      this["talent" + talent[i].name] = this.readBytes(this.talentPoints);
    }

    //this.printDebug()
  }

  generateTalentString(type, points) {
    points = points || this.talentPoints;
    let talentString = "";
    let index = talent.findIndex((element) => {
      return element.name === type;
    });
    let stars = this["star" + type];
    let min = talent[index].min + Math.min(stars, 2);
    let max = talent[index].max + Math.floor(stars / 3);

    for (var i = 0; i < points; i++)
      talentString += toBytes(getRandomInt(min, max), "writeUInt8");

    return talentString;
  }

  serialize() {
    let brotherHex = "";

    brotherHex += toBytes(this.visualLayerMap.size).padStart(2, "0");

    for (let [key, layer] of this.visualLayerMap) {
      brotherHex += toBytes(key, "string");
      brotherHex += layer.value;
      brotherHex += layer.separator;
    }

    brotherHex += this.header + toBytes(this.actionPoints).padStart(2, "0");
    for (var i = 0; i < 8; i++) {
      brotherHex += toBytes(this[statOrder[i]], "writeInt16LE");
    }
    brotherHex += this.greedAndGluttony;
    brotherHex += toBytes(this.pouches).padStart(2, "0");
    brotherHex += toBytes(this.inventory.items, "writeInt8");
    for (var i = 0; i < this.inventory.size; i++) {
      let item = this.inventory.list[i];
      if (!item.isEmpty) brotherHex += Meltdown[item.type](item);
    }

    brotherHex += toBytes(
      this.perks.length + 1 + this.traits.length,
      "writeUInt16LE"
    );
    for (var i = 0; i < this.perks.length; i++)
      brotherHex += this.perks[i] + "00";

    brotherHex += this.background + "00";
    brotherHex += toBytes(this.description, "string");
    brotherHex += toBytes(this.descriptionTemplate, "string");
    brotherHex += this.unknown; //two unknown bytes
    brotherHex += toBytes(this.salaryMultiplier, "writeFloatLE");
    if (this.background === "6DF381C6" || this.background === "CB90AA90")
      //wildman and barbarian tattoo byte
      brotherHex += this.tattoo ? this.tattoo : "00";

    for (var i = 0; i < this.traits.length; i++) {
      brotherHex += this.traits[i].id;

      if (hexDictionary.get(this.traits[i].id).type !== "injury")
        brotherHex += "00";

      if (this.traits[i].event !== undefined)
        brotherHex += this.traits[i].event;
    }

    brotherHex += toBytes(this.name, "string");
    brotherHex += toBytes(this.title, "string");
    brotherHex += toBytes(this.lightWound, "writeFloatLE");
    brotherHex += toBytes(this.experience, "writeUInt32LE");

    brotherHex += this.humanBytes;

    brotherHex += toBytes(this.levelTotal, "writeUInt8");
    brotherHex += toBytes(this.perkPoints, "writeUInt8");
    brotherHex += toBytes(this.perks.length, "writeUInt8"); //instead of old perkUsed
    brotherHex += toBytes(this.levelPoints, "writeUInt8");
    brotherHex += toBytes(this.morale, "writeFloatLE");
    brotherHex += this.moraleModifierHex;

    for (var i = 0; i < 8; i++)
      brotherHex += toBytes(this["star" + talent[i].name], "writeUInt8");

    for (var i = 0; i < 8; i++) {
      brotherHex += toBytes(this.talentPoints, "writeUInt8");
      let binding = "talent" + talent[i].name;
      let points = this.talentPoints * 2;

      if (this[binding].length > points)
        this[binding] = this[binding].slice(0, points);

      if (this[binding].length < points)
        this[binding] = this[binding].padEnd(points, "0");

      brotherHex += this[binding];
    }

    return brotherHex;
  }

  printDebug() {
    console.log(this.serialize());
  }
}

class Stash extends Entity {
  constructor(offset) {
    super(offset);

    this.name = "Company Stash";

    this.capacity = this.readBytes(2, true, "readUInt16LE");
    this.readOffset += 4; //skipping second capacity record
    this.inventory = new Inventory("stash", 0, this.capacity);

    for (var i = 0; i < this.capacity; i++) {
      let item = {};
      item.slot = this.readBytes(1, true);
      if (item.slot === 0)
        //00 is empty slot
        continue;

      item.id = this.readBytes(4).toUpperCase();
      if (!hexDictionary.has(item.id)) {
        getInterface().displayWarning(
          "Unknown Item",
          "origin: stash | id: " + item.id + " Stash will not be displayed."
        );
        console.log("Unknown Item | origin: stash | id: " + item.id);
        this.error = true;
        break;
      }

      item.type = hexDictionary.get(item.id).type;
      Forge[item.type](this, item);
      this.inventory.assign(i, item);
    }
  }

  serialize() {
    let stashHex = "";

    stashHex += toBytes(this.capacity, "writeUInt16LE").repeat(2);

    for (var i = 0; i < this.capacity; i++) {
      let item = this.inventory.list[i];
      if (item === undefined || item.isEmpty) stashHex += "00";
      else stashHex += Meltdown[item.type](item);
    }

    return stashHex;
  }
}

class Interface {
  constructor() {
    this.brotherArray = [];
    this.currentBrother;
    this.filepath;
    this.brotherCount;
    this.writing = false;

    this.warningBox = document.getElementById("warning-box");
    this.warningBox.caption = document.querySelector("#warning-box #caption");
    this.warningBox.message = document.querySelector("#warning-box #message");
    this.warningBox.button = document.querySelector("#warning-box input");

    this.boundInputs = document.querySelectorAll('[data-bind^="brother."]');
    this.inventory = {};
    this.inventory.field = document.getElementById("inventory");
    this.inventory.slotList =
      this.inventory.field.getElementsByClassName("slot");
    this.inventory.editor = document.getElementById("item-editor");
    this.inventory.labels = this.inventory.editor.querySelectorAll("label");
    this.inventory.type = document.getElementById("item-type");
    this.inventory.pickerButton = document.getElementById("picker-button");
    this.inventory.attachmentButton =
      document.getElementById("attachment-select");
    this.inventory.cItem;
    this.inventory.cSlot;

    this.traitField = document.getElementById("traits");

    this.attributeField = document.getElementById("attributes");
    this.starFields = document.getElementsByClassName("star-field");
    this.stars = document.querySelectorAll(".star");

    //tab mapping
    let tabList = document.getElementsByClassName("tab");
    this.tabMap = new Map();
    this.tabMap.set("button-container", document.getElementById("tab-buttons"));
    for (let tab of tabList) this.tabMap.set(tab.id, tab);
    this.tabMap.set(
      "perk-icons",
      this.tabMap.get("perk-page").getElementsByClassName("perk")
    );
    this.tabMap.set(
      "talent-inputs",
      Array.from(this.tabMap.get("editor-page").querySelectorAll("div > input"))
    );

    this.tabMap.set(
      "stash-save-button",
      this.tabMap.get("stash-page").querySelector("input[type='button']")
    );

    this.saveLocation = document.getElementById("save-location");
    this.saveField = document.getElementById("save-inputs");
    this.parseButton = document.getElementById("parse-file");
    this.loadButton = document.getElementById("load-file");
    this.loadButton.addEventListener("click", (e) => {
      e.preventDefault();
      this.openLoadDialog();
    });
    this.brotherList = document.getElementById("brother-list");
    this.backgroundList = document.getElementById("background-list");
    this.traitList = document.getElementById("trait-list");

    this.templates = {};
    let templateList = document.querySelector("template").content.children;
    for (let template of templateList) {
      this.templates[template.dataset.name] = template;
      template.removeAttribute("data-name");
    }

    this.tooltip = document.getElementById("tooltip");
    this.tooltipWatchers = document.querySelectorAll('[data-tooltip="true"]');
    this.overlays = document.getElementsByClassName("overlay");

    this.selectList = [];
  }

  async openLoadDialog() {
    const defaultDir = path.join(
      remote.app.getPath("documents"),
      "Battle Brothers",
      "savegames"
    );

    const { canceled, filePaths } = await remote.dialog.showOpenDialog({
      title: "Select Battle Brothers Save",
      defaultPath: defaultDir,
      filters: [{ name: "Save Files", extensions: ["sav"] }],
      properties: ["openFile"],
    });

    if (canceled || filePaths.length === 0) return;

    this.filepath = filePaths[0];
    this.saveLocation.value = this.filepath;
    // if you want to parse immediately:
    // this.loadData(this.filepath);
  }

  displayWarning(caption, warning) {
    this.warningBox.parentElement.classList.add("active");
    this.warningBox.caption.textContent = caption;
    this.warningBox.message.textContent = warning;
  }

  populateButtons() {
    this.brotherList.innerHTML = "";
    for (var i = 0; i < this.brotherArray.length; i++) {
      this.templates.info.value =
        this.brotherArray[i].title === ""
          ? this.brotherArray[i].name
          : this.brotherArray[i].name + " " + this.brotherArray[i].title;
      this.brotherList.appendChild(this.templates.info.cloneNode());
    }
  }

  populateSlot(slot, item) {
    let record = hexDictionary.get(item.id);

    if (item.isEmpty) {
      if (item.origin === "brother" && slot.classList.contains("pouch"))
        slot.classList.add("active");

      return;
    }

    this.clearDataset(slot);

    slot.dataset.hex = item.id;

    if (item.icon !== undefined) slot.dataset.icon = item.icon;

    if (record.iconSet) slot.dataset.iconSet = record.iconSet;
    else delete slot.dataset.iconSet;

    if (item.attachment && item.attachment !== "00000000") {
      slot.dataset.attachment = item.attachment;
      slot.dataset.attachmentIcon = item.attachmentIcon;
    }

    if (record.slot && record.subType !== "ammo")
      slot.dataset.slot = record.slot;

    if (item.slot === 6) slot.classList.add("active");

    if (item.house) slot.dataset.house = item.house;
  }

  populateInventory(brother) {
    let inventory = brother.inventory.list;

    for (var i = 0; i < inventory.length; i++) {
      let slot = this.inventory.slotList[i];
      this.populateSlot(slot, inventory[i]);
    }
  }

  populateStashPage() {
    let page = this.tabMap.get("stash-page");
    let container = page.children[0];

    for (var i = 0; i < this.stash.capacity; i++) {
      let item = this.stash.inventory.list[i];
      let slot = document.createElement("div");
      slot.className = "slot pouch";
      slot.dataset.pos = i;

      container.insertAdjacentElement("beforeend", slot);
      this.populateSlot(slot, item);
    }

    page.querySelector("input[data-bind*='capacity']").value =
      this.stash.capacity;
  }

  clearDataset(element) {
    let keyList = Object.keys(element.dataset);

    for (var i = 0; i < keyList.length; i++)
      if (keyList[i] !== "pos") delete element.dataset[keyList[i]];
  }

  clearInventory() {
    for (let slot of this.inventory.slotList) {
      this.clearDataset(slot);
      slot.classList.remove("active");
    }
  }

  clearValues(wipe = false) {
    if (wipe) {
      this.brotherList.innerHTML = "";
      //stash page clear
      let stashPage = this.tabMap.get("stash-page");
      stashPage.children[0].innerHTML = "";
      stashPage.querySelector("input[data-bind*='capacity']").value = "";
    }

    this.traitField.innerHTML = "";
    for (var i = 0; i < this.boundInputs.length; i++) {
      if (this.boundInputs[i].tagName === "SELECT")
        this.selectOption(this.boundInputs[i], 0);
      else this.boundInputs[i].value = "";
    }
    for (let icon of this.tabMap.get("perk-icons"))
      icon.classList.remove("active");
    for (var i = 0; i < this.traitList.firstChild.children.length; i++)
      this.traitList.firstChild.children[i].classList.remove("active");
    for (var i = 0; i < this.stars.length; i++)
      this.stars[i].classList.remove("active");

    this.clearInventory();
  }

  fillValues(brother) {
    if (!brother) return;

    for (var i = 0; i < this.boundInputs.length; i++) {
      let binding = this.boundInputs[i].dataset.bind.split(".");

      if (this.boundInputs[i].tagName === "SELECT") {
        if (binding[1] === "visual")
          this.selectOption(
            this.boundInputs[i],
            brother.visualLayerMap.get(binding[2]).value
          );
        else this.selectOption(this.boundInputs[i], brother[binding[1]]);
        continue;
      } else this.boundInputs[i].value = brother[binding[1]];
    }

    for (var i = 0; i < 8; i++) {
      let binding = this.starFields[i].dataset.bind;
      let starDivs = this.starFields[i].childNodes;

      for (var j = 0; j < brother[binding]; j++) {
        starDivs[j].classList.add("active");
      }
    }

    for (var i = 0; i < brother.perks.length; i++) {
      let query = this.tabMap
        .get("perk-page")
        .querySelector('[data-hex="' + brother.perks[i] + '"]');

      if (query) query.classList.add("active");
    }

    this.templates.trait.dataset.hex = brother.background;
    this.traitField.appendChild(this.templates.trait.cloneNode());

    for (var i = 0; i < brother.traits.length; i++) {
      let trait = brother.traits[i].id;

      if (hexDictionary.get(trait).type === "internal") continue;

      let traitListCircle = this.traitList.querySelector(
        '[data-hex="' + trait + '"]'
      );
      if (traitListCircle) traitListCircle.classList.add("active");
      let circle = this.templates.trait.cloneNode();
      circle.dataset.hex = trait;
      if (hexDictionary.get(trait).type === "injury")
        circle.classList.add("injury");

      this.traitField.appendChild(circle);
    }
    //add trait adding button, hexcode TOOL0000, yeah, it's invalid on purpose
    this.templates.trait.dataset.hex = "TOOL0000";
    this.traitField.appendChild(this.templates.trait.cloneNode());

    this.populateInventory(brother);
  }

  adjustValue(target, min, max, isFloat) {
    if (!isFloat && !target.value.isInteger && target.value !== "")
      target.value = Math.floor(target.value);
    if (target.value > max) target.value = max;
    if (target.value < min && target.value !== "") target.value = min;
  }

  populatePicker(slot, origin) {
    let picker = this.overlays.namedItem("item-picker").children[0];
    let oldType;
    let newType;

    let itemList = picker.children;

    while (itemList.length) {
      itemList[0].remove();
    }

    for (let [id, record] of hexDictionary) {
      if (slot !== undefined && record.slot !== slot) continue;

      let item = document.createElement("div");
      item.className = "slot";
      item.dataset.hex = id;
      item.dataset.slot = slot;
      item.dataset.type = record.type;
      item.dataset.subType = record.subType;
      item.dataset.icon = record.icon ? record.icon : 1;
      item.dataset.iconSet = record.iconSet ? record.iconSet : "";
      item.dataset.house = 5;

      newType = record.type;

      if (newType !== oldType && oldType) {
        picker.appendChild(document.createElement("br"));
        picker.appendChild(document.createElement("br"));
      }

      picker.appendChild(item);

      oldType = record.type;
    }

    picker.parentElement.dataset.origin = origin;
    picker.parentElement.classList.add("active");
  }

  processSelectElement(select) {
    let fauxSelect = this.templates.select.cloneNode(true);
    fauxSelect.dataset.bind = select.id;
    let fauxOptionList = fauxSelect.children[1];

    for (var i = 0; i < select.options.length; i++) {
      let option = select.options[i];
      let fauxOption = this.templates.option.cloneNode();

      fauxOption.dataset.index = i;
      fauxOption.dataset.value = option.value;
      fauxOption.dataset.text = option.textContent;
      fauxOptionList.insertAdjacentElement("beforeend", fauxOption);
    }

    fauxSelect.dataset.value = fauxOptionList.children[0].dataset.value;
    fauxSelect.dataset.text = fauxOptionList.children[0].dataset.text;
    select.insertAdjacentElement("beforebegin", fauxSelect);

    this.selectList.push(fauxSelect);
  }

  hideFauxOptionLists() {
    for (let select of this.selectList) select.classList.remove("active");
  }

  selectOption(select, value, fireEvent) {
    let selectedOption;

    if (value === 0 || value === "empty") selectedOption = select.options[0];
    else
      for (let option of select.options) {
        if (option.value === value) {
          selectedOption = option;
          break;
        }
      }

    if (selectedOption) {
      selectedOption.selected = true;
      let fauxSelect = select.previousElementSibling;
      fauxSelect.dataset.text = selectedOption.textContent;
      fauxSelect.dataset.value = selectedOption.value;

      if (fireEvent) {
        let event = new Event("input", { bubbles: true, cancelable: true });
        select.dispatchEvent(event);
      }
    }
  }

  loadData(filepath) {
    if (!filepath)
      return this.displayWarning(
        "Seriously?",
        "You forgot the file path, genius."
      );

    this.clearValues(true);

    fs.readFile(this.filepath, "hex", (err, data) => {
      if (err) {
        this.displayWarning(
          "You broke something.",
          "The file ain't there, chum. Watcha gunna do 'bout it?"
        );
        return console.log(err);
      }
      saveData = data;
      this.startParsing();
    });
  }

  startParsing() {
    sigOffsets.length = 0;
    this.brotherArray.length = 0;

    let re = /000000000000007D2C10000000000000D4C4A7E9000100000102000000/gi;
    let result = re.exec(saveData);
    re.lastIndex = 0;

    this.brotherCount = parseInt(
      getSubstring(saveData, result.index - 38, 2),
      16
    );

    for (var i = 0; i < this.brotherCount; i++) {
      result = re.exec(saveData);
      sigOffsets.push(result.index + 58);
    }

    for (var i = 0; i < sigOffsets.length; i++) {
      let bb = new battleBrother(sigOffsets[i]);
      this.brotherArray.push(bb);
    }

    this.populateButtons(this.brotherArray);

    let stashRe =
      /4E6563726F6D616E63657273.{0,512}E044C501.{0,128}((?!0000).{4})\1/gi; //seek E044C501 after Necromancers followed by repeating non-zero 2 byte pattern
    result = stashRe.exec(saveData);

    this.stash = new Stash(result.index + result[0].length - 8);
    if (!this.stash.error) this.populateStashPage();
  }

  populateItemEditor() {
    let item = this.inventory.cItem;
    let slot = this.inventory.cSlot;
    let record = hexDictionary.get(item.id);

    this.inventory.type.textContent = item.id
      ? record.name
      : "Just some empty slot, mate!";

    for (let label of this.inventory.labels) {
      let input = label.lastElementChild;
      let binding = input.dataset.bind.split(".");
      let value = item[binding[1]];

      input.value = "";
      label.classList.remove("active");

      if (value !== undefined || binding[1] === "id") {
        if (input.tagName === "SELECT") this.selectOption(input, value);
        else if (binding[1] === "attachment")
          input.value = hexDictionary.get(item.attachment).name;
        else input.value = value !== undefined ? value : "";

        label.classList.add("active");
      }
    }

    if ((record && record.slot) || slot.id)
      //show picker when possible
      this.inventory.pickerButton.classList.add("active");
    else this.inventory.pickerButton.classList.remove("active");

    this.inventory.editor.classList.add("active");
  }

  writeSaveData(entity, fragment = "") {
    if (this.writing) return;

    if (entity === undefined)
      return this.displayWarning(
        "Logic Hurdle",
        "No brother selected, nothing to save!"
      );

    if (entity.error)
      return this.displayWarning(
        "Faulty Stash",
        "Stash parsing was unsuccessful earlier, saving was aborted."
      );

    this.writing = true;

    if (!fragment) fragment = entity.serialize();

    let data = saveData.slice(0, entity.offset);
    data += fragment.toLowerCase();
    data += saveData.slice(entity.offset + entity.readOffset);

    let dataBuffer = Buffer.from(data, "hex");

    fs.writeFile(this.filepath, dataBuffer, (err) => {
      if (err) throw err;

      saveData = data;

      let index;

      this.clearValues(true);

      if (this.currentBrother) {
        index = this.brotherArray.indexOf(this.currentBrother);
        this.currentBrother = "";
      }

      this.startParsing();

      if (index !== undefined) {
        this.currentBrother = this.brotherArray[index];
        this.fillValues(this.currentBrother);
      }

      this.writing = false;
      this.displayWarning(
        "Saving done!",
        "Changes to " +
          entity.name +
          " applied. All other changes were discarded."
      );
    });
  }

  updateTalentBytes(type) {
    if (type !== undefined) {
      let index = this.tabMap.get("talent-inputs").findIndex((element) => {
        return element.dataset.bind.includes(type);
      });
      this.tabMap.get("talent-inputs")[index].value =
        this.currentBrother["talent" + type];
      return;
    }

    for (var i = 0; i < this.tabMap.get("talent-inputs").length; i++) {
      let type = this.tabMap
        .get("talent-inputs")
        [i].dataset.bind.replace("brother.", "");
      this.tabMap.get("talent-inputs")[i].value = this.currentBrother[type];
    }
  }

  handleStarChange(target) {
    if (!target.classList.contains("star") || !this.currentBrother) return;
    let binding = target.parentElement.dataset.bind;
    let stars = Array.from(target.parentElement.childNodes);
    let index = stars.indexOf(target);
    let type = binding.replace("star", "");

    for (var i = 0; i < 3; i++) stars[i].classList.remove("active");

    if (this.currentBrother[binding] === 1 && index === 0) {
      this.currentBrother[binding] = 0;
      this.currentBrother["talent" + type] =
        this.currentBrother.generateTalentString(type);
      this.updateTalentBytes(type);
      return;
    }

    this.currentBrother[binding] = index + 1;
    this.currentBrother["talent" + type] =
      this.currentBrother.generateTalentString(type);
    this.updateTalentBytes(type);
    for (var i = 0; i <= index; i++) stars[i].classList.add("active");
  }

  handleTalentPointChange(points) {
    for (var i = 0; i < this.tabMap.get("talent-inputs").length; i++) {
      let binding = this.tabMap
        .get("talent-inputs")
        [i].dataset.bind.replace("brother.", "");
      let type = binding.replace("talent", "");
      let value = this.currentBrother[binding];
      if (value.length % 2 === 1) value = value.slice(0, value.length - 1);
      let difference =
        this.tabMap.get("talent-inputs")[i].value.length - points * 2;

      if (difference === 0) continue;
      if (difference > 0) value = value.slice(0, points * 2);
      if (difference < 0)
        value += this.currentBrother.generateTalentString(
          type,
          difference / -2
        );

      this.currentBrother[binding] = value;
    }
    this.updateTalentBytes();
  }

  handleItemID(input) {
    let value = input.value.toUpperCase();
    let item = this.inventory.cItem;
    let recordOld = hexDictionary.get(item.id);
    let recordNew = hexDictionary.get(value);

    if (value.search(/[^a-f0-9]/gi) > 0)
      input.value = value.replace(/[^a-f0-9]/gi, "");
    if (value.length < 8) return;
    if (input.value.length > 8) input.value = value.slice(0, 8);
    if (!hexDictionary.has(value))
      return this.displayWarning(
        "Invalid ID",
        "No such item exists in hex dictionary."
      );

    //type migration
    if (
      ((item.isEmpty || recordNew.type !== recordOld.type) &&
        blank[recordNew.type]) ||
      recordNew.type === "namedWeapon"
    ) {
      let slot;

      if (item.origin === "brother") {
        let slotIndex = Math.min(6, this.inventory.cSlot.dataset.pos);

        if (recordNew.slot !== SlotNames[slotIndex] && slotIndex !== 6)
          return this.displayWarning(
            "Type Mismatch",
            "This item type is not accepted in current slot."
          );

        if (item.isEmpty) this.currentBrother.inventory.items++;

        slot = item.slot || slotIndex;
      }

      if (item.origin === "stash") slot = 1;

      item.assign(blank[recordNew.type]);
      item.slot = parseInt(slot);
    }

    //subType migration
    let oldType = recordOld ? recordOld.subType : "";
    let newType = recordNew.subType;

    if (oldType !== newType) {
      if (newType === "provisions") item.expiry = 9999999999;
      if (newType === "nobleShield" || newType === "nobleArmor") item.house = 1;
      if (newType === "masterworkBow") item.name = "Masterwork Bow";
      if (newType === "canine") item.name = "Battle Canine";
      if (newType === "davkul")
        item.description =
          "A grisly aspect of Davkul, an ancient power not from this world, and the " +
          "last remnants of Hans the Flammenwerfer from whose body it has been fashioned. " +
          "It shall never break, but instead keep regrowing its scarred skin on the spot.";
      if (newType === "ammo") item.ammo = 0;
      if (newType === "commodity") item.bought = 0;

      if (oldType === "provisions") delete item.expiry;
      if (oldType === "nobleShield" || oldType === "nobleArmor")
        delete item.house;
      if (oldType === "masterworkBow" || oldType === "canine") delete item.name;
      if (oldType === "davkul") delete item.description;
      if (oldType === "ammo") delete item.ammo;
      if (oldType === "commodity") delete item.bought;
    }

    //clear attachment
    if (recordNew.slot === "body" && item.attachment === undefined)
      item.attachment = "00000000";
    else if (recordNew.slot !== "body" && item.attachment !== undefined)
      delete item.attachment;

    item.id = value;

    //do not create new props or overwrite slot
    for (let property in recordNew)
      if (item[property] !== undefined && property !== "slot")
        item[property] = recordNew[property];

    if (ItemValueRandomizer[item.type]) ItemValueRandomizer[item.type](item);

    if (item.maxDurability) item.maxDurability = item.durability;

    if (item.baseDurability) item.baseDurability = item.durability;

    if (item.baseFatigue) item.baseFatigue = item.fatigue;

    this.populateItemEditor();
  }

  showTooltip(hex, rect) {
    if (!hexDictionary.has(hex)) return;

    this.tooltip.classList.add("active");
    this.tooltip.textContent = hexDictionary.get(hex).name;
    this.tooltip.style.top = rect.top - this.tooltip.offsetHeight - 3 + "px";

    let offsetLeft = rect.left + rect.width / 2 - this.tooltip.offsetWidth / 2;
    offsetLeft = Math.max(0, offsetLeft);
    offsetLeft = Math.min(offsetLeft, 1030 - this.tooltip.offsetWidth);
    this.tooltip.style.left = offsetLeft + "px";
  }

  hideTooltip() {
    this.tooltip.textContent = "";
    this.tooltip.classList.remove("active");
    this.tooltip.style.top = "0px";
    this.tooltip.style.left = "0px";
  }

  handleInput(event) {
    let target = event.target;

    if (target.dataset.min !== undefined) {
      let min = 0;
      let max = 0;
      let isFloat = target.dataset.float !== undefined;
      if (isFloat) {
        min = parseFloat(target.dataset.min);
        max = parseFloat(target.dataset.max);
      } else {
        min = parseInt(target.dataset.min);
        max = parseInt(target.dataset.max);
      }
      this.adjustValue(target, min, max, isFloat);
    }

    if (target.dataset.bind === undefined) return;

    let value = target.value;

    if (target.type === "number") {
      if (value === "") return;

      value = value || 0; //safeguard, I guess; that soap is nice

      if (target.dataset.float !== undefined) value = parseFloat(value);
      else value = parseInt(value);
    }

    let binding = target.dataset.bind.split(".");

    if (target.dataset.bind === "gui.filepath" && target.value.includes('"'))
      value = value.replace(/"/g, "");
    if (binding[0] === "gui") {
      this[binding[1]] = value;
      return;
    }

    if (target.dataset.bind === "item.id") {
      this.handleItemID(target);
      return;
    }

    if (binding[0] === "stash") {
      this.stash[binding[1]] = value;
      return;
    }

    //attachment handler
    if (target.dataset.bind === "item.attachment") {
      let item = this.inventory.cItem;

      if (item.type === "genericArmor") {
        item.attachment = value;
        item.fatigue =
          hexDictionary.get(item.id).fatigue +
          hexDictionary.get(item.attachment).fatigue;
        item.durability =
          hexDictionary.get(item.id).durability +
          hexDictionary.get(item.attachment).durability;

        //Light Padding adjustment
        if (item.attachment === "9EEC2513")
          item.fatigue = Math.floor(item.baseFatigue * 0.8);
      } else {
        item.attachment = value;

        item.fatigue =
          item.baseFatigue + hexDictionary.get(item.attachment).fatigue;
        item.maxDurability =
          item.baseDurability + hexDictionary.get(item.attachment).durability;
        item.durability = item.maxDurability;

        //Light Padding adjustment
        if (item.attachment === "9EEC2513")
          item.fatigue = Math.floor(item.baseFatigue * 0.8);
      }

      if (item.attachment === "00000000") delete item.attachmentIcon;
      else item.attachmentIcon = hexDictionary.get(item.attachment).icon || 0;

      this.populateItemEditor();
      return;
    }

    //item editor bindings
    if (binding[0] === "item") {
      let item = this.inventory.cItem;

      if (item.type === "namedArmor") {
        if (binding[1] === "fatigue") {
          if (item.attachment !== "9EEC2513")
            //light padding replacement decreases fat by 20%, so we need to bump up base fat by 25% to get back
            item.baseFatigue += value - item.fatigue;
          else item.baseFatigue = Math.ceil(value * 1.25);
        }

        if (binding[1] === "maxDurability")
          item.baseDurability += value - item.maxDurability;
      }

      if (binding[1] === "durability" && "maxDurability" in item) {
        item.maxDurability = value;

        if (item.type === "namedArmor")
          item.baseDurability += value - item.durability;
      }

      item[binding[1]] = value;

      return;
    }

    //brother bindings
    if (this.currentBrother === undefined) return;

    if (binding[1] === "visual")
      this.currentBrother.visualLayerMap.get(binding[2]).value = value;

    if (binding[1].includes("talent") && target.value.search(/[^a-f0-9]/gi) > 0)
      target.value = target.value.replace(/[^a-f0-9]/gi, "");
    if (
      binding[1] === "talentPoints" &&
      value !== this.currentBrother.talentPoints
    )
      this.handleTalentPointChange(value);
    if (binding[0] === "brother") this.currentBrother[binding[1]] = value;
  }

  initEventListeners() {
    this.warningBox.button.addEventListener("click", (event) => {
      this.warningBox.parentElement.classList.remove("active");
    });

    //prevent ugly selection on doubleclick in perk section
    this.tabMap.get("perk-page").addEventListener("mousedown", (event) => {
      event.preventDefault();
    });

    //change perk state, set changes to selected brother
    this.tabMap.get("perk-page").addEventListener("click", (event) => {
      if (!event.target.classList.contains("perk")) return;

      let brother = this.currentBrother;
      let hex = event.target.dataset.hex;

      if (brother.perks.includes(hex)) {
        let index = brother.perks.indexOf(hex);
        brother.perks.splice(index, 1);
      } else {
        brother.perks.push(hex);
      }

      //bags and belts perk interaction
      if (hex === "A546AF20") {
        brother.pouches = brother.perks.includes(hex) ? 4 : 2;
        brother.inventory.resize(6 + brother.pouches);
        this.clearInventory();
        this.populateInventory(brother);
      }

      event.target.classList.toggle("active");
    });

    //trait field functionality
    this.traitField.addEventListener("click", (event) => {
      let hex = event.target.dataset.hex;

      if (hex === "TOOL0000") {
        this.traitList.classList.add("active");
        return;
      }

      if (hexDictionary.get(hex).type === "background") {
        this.backgroundList.classList.add("active");
        return;
      }

      let index = this.currentBrother.traits.findIndex((element) => {
        return element.id === hex;
      });
      let traitListCircle = this.traitList.querySelector(
        '[data-hex="' + hex + '"]'
      );
      if (traitListCircle) traitListCircle.classList.remove("active");

      this.currentBrother.traits.splice(index, 1);
      //prophet and voice of davkul
      if (hex === "2EBB3F39") {
        let index = this.currentBrother.traits.findIndex((element) => {
          return element.id === "80ED057C";
        });
        if (index >= 0) this.currentBrother.traits.splice(index, 1);
      }

      event.target.parentElement.removeChild(event.target);
    });

    this.backgroundList.addEventListener("click", (event) => {
      let hex = event.target.dataset.hex;
      if (hex === undefined || hex === this.currentBrother.background) return;

      this.currentBrother.background = hex;
      this.traitField.firstChild.dataset.hex = hex;
      this.backgroundList.classList.remove("active");
    });

    this.traitList.addEventListener("click", (event) => {
      let hex = event.target.dataset.hex;

      if (hex === undefined) return;

      let index = this.currentBrother.traits.findIndex((element) => {
        return element.id === hex;
      });

      if (index >= 0) {
        //prophet and voice of davkul
        if (hex === "2EBB3F39") {
          let index = this.currentBrother.traits.findIndex((element) => {
            return element.id === "80ED057C";
          });
          if (index >= 0) this.currentBrother.traits.splice(index, 1);
        }

        this.currentBrother.traits.splice(index, 1);
        this.traitField.removeChild(this.traitField.children[1 + index]);
        event.target.classList.remove("active");
      } else {
        this.currentBrother.traits.splice(-2, 0, { id: hex });

        //prophet and voice of davkul
        if (hex === "2EBB3F39")
          this.currentBrother.traits.splice(-2, 0, { id: "80ED057C" });

        event.target.classList.add("active");
        index = this.traitField.children.length - 1;
        this.templates.trait.dataset.hex = hex;
        this.traitField.insertBefore(
          this.templates.trait.cloneNode(),
          this.traitField.children[index]
        );
      }
    });

    //attribute stars
    this.attributeField.addEventListener("click", (event) => {
      this.handleStarChange(event.target);
    });

    //tab buttons
    this.tabMap.get("button-container").addEventListener("click", (event) => {
      if (
        event.target.classList.contains("active") ||
        event.target.type !== "button"
      )
        return;

      let toggle = "active";
      let buttons = this.tabMap.get("button-container").children;
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.remove(toggle);
        this.tabMap.get(buttons[i].dataset.tab).classList.remove(toggle);
      }
      event.target.classList.add(toggle);
      this.tabMap.get(event.target.dataset.tab).classList.add(toggle);
    });

    //brother list buttons
    this.brotherList.addEventListener("click", (event) => {
      if (event.target.classList.contains("fill-info")) {
        this.clearValues();
        let target = event.target;
        for (var i = 0; (target = target.previousSibling); i++); //incredible hack to avoid creating new array each time the button is pressed
        this.currentBrother = this.brotherArray[i];
        this.fillValues(this.currentBrother);
      }
    });

    //parse button
    this.parseButton.addEventListener("click", (event) => {
      this.loadData(this.filepath);
    });

    //save-input buttons
    this.saveField.addEventListener("click", (event) => {
      if (event.target.id === "save-character")
        this.writeSaveData(this.currentBrother);

      if (event.target.id === "copy-character") {
        this.saveField.children[0].value = "";
        let input = document.createElement("textarea");
        let hexString = "[Character Hex: " + this.currentBrother.name;
        hexString += this.currentBrother.title
          ? " " + this.currentBrother.title + "]\n"
          : "]\n";
        hexString += this.currentBrother
          .serialize()
          .toUpperCase()
          .replace(/(.{2})/g, "$1 ");
        document.body.appendChild(input);
        input.value = hexString;
        input.select();
        document.execCommand("cut");
        document.body.removeChild(input);
        return;
      }

      if (event.target.id === "replace-character") {
        let hex = this.saveField.children[0].value;
        if (!hex || this.currentBrother === undefined || hex.length < 400)
          return;

        this.saveField.children[0].value = "";
        hex = hex.replace(/\[.+\]\s|\s/gi, "");
        this.writeSaveData(this.currentBrother, hex);
      }
    });

    //stash click
    this.tabMap.get("stash-page").addEventListener("click", (event) => {
      if (event.target.id === "save-stash") {
        this.writeSaveData(this.stash);
        return;
      }

      if (!event.target.classList.contains("slot") || this.stash.error) return;

      let pos = event.target.dataset.pos;
      this.inventory.cItem = this.stash.inventory.list[pos];
      this.inventory.cSlot = event.target;
      this.populateItemEditor();
    });

    //inventory click
    this.inventory.field.addEventListener("click", (event) => {
      if (
        !event.target.classList.contains("slot") ||
        this.currentBrother === undefined
      )
        return;

      let pos = event.target.dataset.pos;
      this.inventory.cItem = this.currentBrother.inventory.list[pos];
      this.inventory.cSlot = event.target;
      this.populateItemEditor();
    });

    //item ID picker
    this.inventory.pickerButton.addEventListener("click", (event) => {
      let slotType;
      let slot = this.inventory.cSlot;
      let item = this.inventory.cItem;
      let record = hexDictionary.get(item.id);

      if (slot.id || (record && record.slot)) slotType = slot.id || record.slot;
      else return;

      this.populatePicker(slotType, "item-picker");
    });

    //attachment picker
    this.inventory.attachmentButton.addEventListener("click", (event) => {
      this.populatePicker("attachment", "attachment-picker");
    });

    //item picker click
    this.overlays
      .namedItem("item-picker")
      .addEventListener("click", (event) => {
        if (!event.target.classList.contains("slot")) return;

        let input;
        let origin = this.overlays.namedItem("item-picker").dataset.origin;

        if (origin === "attachment-picker")
          input = this.inventory.attachmentButton;
        else input = document.querySelector("[data-bind='item.id']");

        input.value = event.target.dataset.hex;

        this.overlays.namedItem("item-picker").classList.remove("active");

        let inputEvent = new Event("input", {
          bubbles: true,
          cancelable: true,
        });
        input.dispatchEvent(inputEvent);
      });

    //document-wide click event
    document.addEventListener("click", (event) => {
      //faux select functionality
      if (event.target.tagName === "SELECT") return;

      let boolFauxSelect;
      if (event.target.className === "faux-select") boolFauxSelect = true;

      this.hideFauxOptionLists();
      if (boolFauxSelect) event.target.classList.add("active");

      if (event.target.classList.contains("faux-option")) {
        let fauxSelect = event.target.closest(".faux-select");
        let select = document.getElementById(fauxSelect.dataset.bind);
        this.selectOption(select, event.target.dataset.value, true);
      }
    });

    //hotkeys and whatnot
    document.addEventListener("keydown", async (event) => {
      if (event.key === "Escape") {
        for (var i = this.overlays.length - 1; i >= 0; i--) {
          if (this.overlays[i].classList.contains("active")) {
            if (this.overlays[i].id === "item-editor") {
              this.populateSlot(this.inventory.cSlot, this.inventory.cItem);
              this.inventory.cSlot = this.inventory.cItem = null;
            }
            this.overlays[i].classList.remove("active");
            return;
          }
        }
      }

      // ignore if any modifier other than Ctrl is down
      if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey)
        return;

      if ((event.key === "l" || event.key === "L") && event.ctrlKey) {
        event.preventDefault();
        this.openLoadDialog();
      }

      if ((event.key === "p" || event.key === "P") && event.ctrlKey)
        this.loadData(this.filepath);

      if ((event.key === "s" || event.key === "S") && event.ctrlKey)
        this.writeSaveData(this.currentBrother);

      if (event.key === "F1")
        this.overlays.namedItem("help").classList.add("active");
    });

    //fookin' tooltips, mate
    document.addEventListener("mouseover", (event) => {
      let hex = event.target.dataset.hex;
      if (hex === undefined || hex === "") return;
      let rect = event.target.getBoundingClientRect();
      this.showTooltip(hex, rect);
    });

    document.addEventListener("mouseout", (event) => {
      let hex = event.target.dataset.hex;
      if (hex === undefined || hex === "") return;
      this.hideTooltip();
    });

    //watch inputs, adjust their value, pass it to relevant variable
    document.addEventListener("input", (event) => {
      this.handleInput(event);
    });
  }
}

module.exports = { Interface, battleBrother, Stash };
