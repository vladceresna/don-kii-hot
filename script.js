/** ==========================================
 *  Терминал и Виртуальная Файловая Система
 *  ========================================== */
const Terminal = {
  outputEl: document.getElementById("terminal-output"),
  inputLine: document.getElementById("terminal-input-line"),
  inputEl: document.getElementById("terminal-input"),
  resolveInput: null,

  print: (text) => {
    Terminal.outputEl.textContent += text;
    Terminal.scrollToBottom();
  },
  println: (text) => {
    Terminal.outputEl.textContent += text + "\n";
    Terminal.scrollToBottom();
  },
  clear: () => {
    Terminal.outputEl.textContent = "";
  },
  scrollToBottom: () => {
    document.getElementById("terminal-pane").scrollTop =
      document.getElementById("terminal-pane").scrollHeight;
  },

  // Асинхронное ожидание ввода (замена Console.ReadLine)
  readAsync: () => {
    return new Promise((resolve) => {
      Terminal.inputLine.style.display = "flex";
      Terminal.inputEl.value = "";
      Terminal.inputEl.focus();
      Terminal.resolveInput = resolve;
    });
  },
};

Terminal.inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && Terminal.resolveInput) {
    const val = Terminal.inputEl.value;
    Terminal.println(val); // эхо ввода
    Terminal.inputLine.style.display = "none";
    let resolve = Terminal.resolveInput;
    Terminal.resolveInput = null;
    resolve(val);
  }
});

const VirtualFS = {
  files: { "main.kii": "" },
  read: (name) => VirtualFS.files[name] || null,
  write: (name, content) => {
    VirtualFS.files[name] = content;
  },
};

/** ==========================================
 *  Языковые структуры (Переменные, Память)
 *  ========================================== */
const Types = { Int: 0, String: 1, Boolean: 2, List: 3, Null: 4 };

class Variable {
  constructor(content, isStatic = false) {
    this.isStatic = isStatic;
    if (content instanceof Variable) content = content.Get(); // Unbox

    this.content = content;
    if (
      typeof content === "boolean" ||
      content === "true" ||
      content === "false"
    ) {
      this.type = Types.Boolean;
      this.content = content === true || content === "true";
    } else if (Array.isArray(content)) {
      this.type = Types.List;
    } else if (
      !isNaN(content) &&
      content !== "" &&
      content !== null &&
      typeof content !== "boolean"
    ) {
      this.type = Types.Int;
      this.content = parseInt(content);
    } else if (content === null || content === undefined) {
      this.type = Types.Null;
    } else {
      this.type = Types.String;
      this.content = String(content);
    }
  }
  Set(val) {
    this.content = val;
  }
  Get() {
    return this.content;
  }
}

class Memory {
  constructor() {
    this.variables = {};
  }
  Clean() {
    for (let key in this.variables) {
      if (!this.variables[key].isStatic) delete this.variables[key];
    }
  }
}

class Ch {
  static VarExist(block, name) {
    if (
      typeof name === "string" &&
      Executor.MemoryOfBlocks[block]?.variables[name]
    ) {
      return Executor.MemoryOfBlocks[block].variables[name].Get();
    }
    if (name === "true") return true;
    if (name === "false") return false;
    return name;
  }
}

/** ==========================================
 *  Операторы (Переписаны под JS и Async)
 *  ========================================== */
const OPs = {};

// Вспомогательная функция для регистрации операторов
function regOp(sign, priority, isBinary, action) {
  OPs[sign] = { priority, isBinary, Do: action };
}

// Математика
regOp("*", 5, true, async (ctx, args) =>
  args.reduce((acc, y) => acc * parseInt(Ch.VarExist(ctx.block, y)), 1),
);
regOp(
  "/",
  5,
  true,
  async (ctx, args) =>
    parseInt(Ch.VarExist(ctx.block, args[0])) /
    parseInt(Ch.VarExist(ctx.block, args[1])),
);
regOp(
  "|",
  5,
  true,
  async (ctx, args) =>
    parseFloat(Ch.VarExist(ctx.block, args[0])) /
    parseFloat(Ch.VarExist(ctx.block, args[1])),
);
regOp("+", 4, true, async (ctx, args) => {
  try {
    let isStr = args.some((y) => isNaN(Ch.VarExist(ctx.block, y)));
    if (isStr) return args.map((y) => Ch.VarExist(ctx.block, y)).join("");
    return args.reduce(
      (acc, y) => acc + parseInt(Ch.VarExist(ctx.block, y)),
      0,
    );
  } catch {
    return args.map((y) => Ch.VarExist(ctx.block, y)).join("");
  }
});
regOp(
  "-",
  4,
  true,
  async (ctx, args) =>
    parseInt(Ch.VarExist(ctx.block, args[0])) -
    parseInt(Ch.VarExist(ctx.block, args[1])),
);

// Логика и сравнение
regOp(
  "!",
  3,
  false,
  async (ctx, args) => !Boolean(Ch.VarExist(ctx.block, args[0])),
);
regOp(
  ">",
  3,
  true,
  async (ctx, args) =>
    parseInt(Ch.VarExist(ctx.block, args[0])) >
    parseInt(Ch.VarExist(ctx.block, args[1])),
);
regOp(
  "<",
  3,
  true,
  async (ctx, args) =>
    parseInt(Ch.VarExist(ctx.block, args[0])) <
    parseInt(Ch.VarExist(ctx.block, args[1])),
);
regOp(
  ">=",
  3,
  true,
  async (ctx, args) =>
    parseInt(Ch.VarExist(ctx.block, args[0])) >=
    parseInt(Ch.VarExist(ctx.block, args[1])),
);
regOp(
  "<=",
  3,
  true,
  async (ctx, args) =>
    parseInt(Ch.VarExist(ctx.block, args[0])) <=
    parseInt(Ch.VarExist(ctx.block, args[1])),
);
regOp(
  "==",
  3,
  true,
  async (ctx, args) =>
    String(Ch.VarExist(ctx.block, args[0])) ===
    String(Ch.VarExist(ctx.block, args[1])),
);
regOp(
  "!=",
  3,
  true,
  async (ctx, args) =>
    String(Ch.VarExist(ctx.block, args[0])) !==
    String(Ch.VarExist(ctx.block, args[1])),
);
regOp(
  "&&",
  2,
  true,
  async (ctx, args) =>
    Boolean(Ch.VarExist(ctx.block, args[0])) &&
    Boolean(Ch.VarExist(ctx.block, args[1])),
);
regOp(
  "||",
  2,
  true,
  async (ctx, args) =>
    Boolean(Ch.VarExist(ctx.block, args[0])) ||
    Boolean(Ch.VarExist(ctx.block, args[1])),
);

// Присваивание
regOp("=", 0, true, async (ctx, args) => {
  let val = Ch.VarExist(ctx.block, args[1]);
  Executor.MemoryOfBlocks[ctx.block].variables[args[0]] = new Variable(val);
  return val;
});
regOp("#=", 0, true, async (ctx, args) => {
  let val = Ch.VarExist(ctx.block, args[1]);
  let mem = Executor.MemoryOfBlocks[ctx.block].variables;
  if (!mem[args[0]] || !mem[args[0]].isStatic)
    mem[args[0]] = new Variable(val, true);
  return val;
});
regOp("+=", 0, true, async (ctx, args) => {
  let mem = Executor.MemoryOfBlocks[ctx.block].variables;
  let old = mem[args[0]].Get();
  let add = Ch.VarExist(ctx.block, args[1]);
  mem[args[0]].Set(
    isNaN(old) || isNaN(add) ? old + add : parseInt(old) + parseInt(add),
  );
  return mem[args[0]].Get();
});
regOp("-=", 0, true, async (ctx, args) => {
  let mem = Executor.MemoryOfBlocks[ctx.block].variables;
  mem[args[0]].Set(
    parseInt(mem[args[0]].Get()) - parseInt(Ch.VarExist(ctx.block, args[1])),
  );
});
regOp("*=", 0, true, async (ctx, args) => {
  let mem = Executor.MemoryOfBlocks[ctx.block].variables;
  mem[args[0]].Set(
    parseInt(mem[args[0]].Get()) * parseInt(Ch.VarExist(ctx.block, args[1])),
  );
});
regOp("/=", 0, true, async (ctx, args) => {
  let mem = Executor.MemoryOfBlocks[ctx.block].variables;
  mem[args[0]].Set(
    Math.floor(
      parseInt(mem[args[0]].Get()) / parseInt(Ch.VarExist(ctx.block, args[1])),
    ),
  );
});

// Вывод и Ввод
regOp("out", 0, false, async (ctx, args) => {
  let val = Ch.VarExist(ctx.block, args[0]);
  Terminal.print(String(val));
  return val;
});
regOp("outln", 0, false, async (ctx, args) => {
  let val = Ch.VarExist(ctx.block, args[0]);
  Terminal.println(String(val));
  return val;
});
regOp("print", 0, false, async (ctx, args) => OPs["out"].Do(ctx, args));
regOp("println", 0, false, async (ctx, args) => OPs["outln"].Do(ctx, args));
regOp("in", 0, false, async (ctx, args) => {
  let input = await Terminal.readAsync();
  Executor.MemoryOfBlocks[ctx.block].variables[args[0]] = new Variable(input);
  return "^";
});

// Управление потоком (Blocks)
regOp("run", 0, false, async (ctx, args) => {
  if (Executor.Blocks.includes(args[0])) await Executor.Exec(args[0]);
  return "^";
});
regOp("runif", 0, true, async (ctx, args) => {
  // args[0]=cond, args[1]=target
  let cond = Ch.VarExist(ctx.block, args[0]);
  if (Array.isArray(args[1])) {
    if (cond && Executor.Blocks.includes(args[1][1]))
      await Executor.Exec(args[1][1]);
    else if (!cond && Executor.Blocks.includes(args[1][0]))
      await Executor.Exec(args[1][0]);
  } else {
    if (!cond && Executor.Blocks.includes(args[1]))
      await Executor.Exec(args[1]);
  }
  return "^";
});
regOp("loop", 0, false, async (ctx, args) => {
  let target = String(Ch.VarExist(ctx.block, args[0]));
  if (!Executor.Blocks.includes(target)) throw new Error("K0004");
  while (true) {
    await Executor.Exec(target);
    await new Promise((r) => setTimeout(r, 0)); // Важно для браузера!
  }
});
regOp("equit", 0, false, async (ctx, args) => {
  throw new Error("EXIT");
});

// Передача данных (-> , => , <-)
regOp("->", 0, true, async (ctx, args) => {
  let targets = Array.isArray(args[1]) ? args[1] : [args[1]];
  let vars = Array.isArray(args[0]) ? args[0] : [args[0]];
  for (let target of targets) {
    if (!Executor.Blocks.includes(target)) continue;
    for (let v of vars) {
      Executor.MemoryOfBlocks[target].variables[v] = new Variable(
        Ch.VarExist(ctx.block, v),
      );
    }
  }
  return "^";
});
regOp("=>", 0, true, async (ctx, args) => {
  await OPs["->"].Do(ctx, args);
  await Executor.Exec(args[1]);
  return "^";
});
regOp("<-", 0, true, async (ctx, args) => {
  let targetBlock = Ch.VarExist(ctx.block, args[1]);
  if (Executor.Blocks.includes(targetBlock)) {
    await OPs["->"].Do({ block: targetBlock }, [args[0], ctx.block]);
  }
  return "^";
});

// Списки
regOp(",", 1, true, async (ctx, args) => {
  let lst = [args[0]];
  if (Array.isArray(args[1])) lst.push(...args[1]);
  else lst.push(args[1]);
  return lst;
});
regOp("..", 15, true, async (ctx, args) => {
  let start = parseInt(Ch.VarExist(ctx.block, args[0])),
    end = parseInt(Ch.VarExist(ctx.block, args[1]));
  let res = [];
  for (let i = start; i <= end; i++) res.push(i);
  return res;
});
regOp("len", 6, false, async (ctx, args) => {
  let op = Ch.VarExist(ctx.block, args[0]);
  return Array.isArray(op) ? op.length : String(op).length;
});
regOp(
  "at",
  5,
  true,
  async (ctx, args) =>
    Ch.VarExist(ctx.block, args[1])[parseInt(Ch.VarExist(ctx.block, args[0]))],
);
regOp("lastof", 5, false, async (ctx, args) => {
  let list = Ch.VarExist(ctx.block, args[0]);
  return list[list.length - 1];
});
regOp("[+]", 0, true, async (ctx, args) => {
  let list = Ch.VarExist(ctx.block, args[1]);
  list.push(Ch.VarExist(ctx.block, args[0]));
  Executor.MemoryOfBlocks[ctx.block].variables[args[1]] = new Variable(list);
  return "^";
});
regOp("[-]", 0, true, async (ctx, args) => {
  let list = Ch.VarExist(ctx.block, args[1]);
  let val = Ch.VarExist(ctx.block, args[0]);
  let idx = list.indexOf(val);
  if (idx !== -1) list.splice(idx, 1);
  Executor.MemoryOfBlocks[ctx.block].variables[args[1]] = new Variable(list);
  return "^";
});
regOp("-=]", 0, true, async (ctx, args) => {
  let list = Ch.VarExist(ctx.block, args[1]);
  list.splice(parseInt(Ch.VarExist(ctx.block, args[0])), 1);
  Executor.MemoryOfBlocks[ctx.block].variables[args[1]] = new Variable(list);
  return "^";
});

// Утилиты
regOp("del", 0, false, async (ctx, args) => {
  let vars = Array.isArray(args[0]) ? args[0] : [args[0]];
  for (let v of vars) delete Executor.MemoryOfBlocks[ctx.block].variables[v];
});
regOp("import", 0, false, async (ctx, args) => {
  let file = String(Ch.VarExist(ctx.block, args[0]));
  let code = VirtualFS.read(file);
  if (code !== null) {
    let parsed = Parser.Parse(Lexer.Tokenize(KiiBlockFinder.FindIn(code)));
    Executor.Init(parsed);
    Executor.ImportedFiles.add(file);
  } else throw new Error("K0005");
});
regOp(
  ".",
  15,
  true,
  async (ctx, args) =>
    `${Ch.VarExist(ctx.block, args[0])} ${Ch.VarExist(ctx.block, args[1])}`,
);

/** ==========================================
 *  Лексер и Парсер (Чистый Рекурсивный Спуск)
 *  ========================================== */
class KiiBlockFinder {
  static FindIn(code) {
    let result = { main: [] };
    let currentBlock = "main";
    for (let line of code.replace(/\r/g, "").split("\n")) {
      line = line.trim();
      if (!line || line.startsWith("//")) continue;
      if (line.endsWith(":")) {
        currentBlock = line.slice(0, -1);
        if (!result[currentBlock]) result[currentBlock] = [];
      } else result[currentBlock].push(line);
    }
    return result;
  }
}

class Lexer {
  static Tokenize(blocks) {
    let result = {};
    for (let block in blocks) {
      result[block] = [];
      for (let line of blocks[block]) {
        let tokens = line.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        for (let t of tokens) {
          if (t.startsWith('"') && t.endsWith('"')) {
            result[block].push({
              type: "String",
              content: t.slice(1, -1).replace(/\\n/g, "\n"),
            });
          } else if (t.includes(",") && t !== ",") {
            result[block].push({
              type: "Identifier",
              content: t.replace(/,/g, ""),
            });
            result[block].push({ type: "Operator", content: "," });
          } else if (OPs[t]) {
            result[block].push({ type: "Operator", content: t });
          } else {
            result[block].push({ type: "Identifier", content: t });
          }
        }
        result[block].push({ type: "EndLine", content: ";" });
      }
    }
    return result;
  }
}

// AST узлы
class SingleExpression {
  constructor(val) {
    this.val = val;
  }
  async Do(ctx) {
    return this.val;
  }
}
class Expression {
  constructor(op, one, two = null) {
    this.op = op;
    this.one = one;
    this.two = two;
  }
  async Do(ctx) {
    if (this.two)
      return await OPs[this.op].Do(ctx, [
        await this.one.Do(ctx),
        await this.two.Do(ctx),
      ]);
    return await OPs[this.op].Do(ctx, [await this.one.Do(ctx)]);
  }
}

class Parser {
  static Parse(tokenBlocks) {
    let ast = {};
    for (let b in tokenBlocks) {
      ast[b] = [];
      let tokens = tokenBlocks[b];
      let pos = 0;

      // Простой алгоритм разбора выражений с учетом приоритета, как в C#
      while (pos < tokens.length) {
        if (tokens[pos].type === "EndLine") {
          pos++;
          continue;
        }

        let lineTokens = [];
        while (pos < tokens.length && tokens[pos].type !== "EndLine") {
          lineTokens.push(tokens[pos]);
          pos++;
        }

        if (lineTokens.length > 0) {
          ast[b].push(Parser.ParseLine(lineTokens));
        }
      }
    }
    return ast;
  }

  // Рекурсивный парсинг линии (заменяет громоздкий Prioritize из C#)
  static ParseLine(tokens) {
    if (tokens.length === 0) return null;
    if (tokens.length === 1) return new SingleExpression(tokens[0].content);

    // Находим оператор с НАИМЕНЬШИМ приоритетом, он будет корнем
    let minPriority = 999;
    let opIndex = -1;

    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type === "Operator") {
        let p = OPs[tokens[i].content].priority;
        // Идем справа налево для ассоциативности
        if (p <= minPriority) {
          minPriority = p;
          opIndex = i;
        }
      }
    }

    if (opIndex === -1) return new SingleExpression(tokens[0].content); // Fallback

    let op = tokens[opIndex].content;
    let isBin = OPs[op].isBinary;

    if (isBin) {
      let left = Parser.ParseLine(tokens.slice(0, opIndex));
      let right = Parser.ParseLine(tokens.slice(opIndex + 1));
      return new Expression(op, left || new SingleExpression(""), right);
    } else {
      // Унарный оператор может быть слева (out, print) или обрабатывать остаток строки
      let right = Parser.ParseLine(tokens.slice(opIndex + 1));
      return new Expression(op, right);
    }
  }
}

/** ==========================================
 *  Движок (Executor)
 *  ========================================== */
class Executor {
  static Blocks = [];
  static MemoryOfBlocks = {};
  static AllTheBlocks = {};
  static ImportedFiles = new Set();
  static BlocksInUse = new Set();

  static Init(expressions) {
    for (let key in expressions) this.AllTheBlocks[key] = expressions[key];
    for (let key in expressions)
      if (!this.Blocks.includes(key)) this.Blocks.push(key);
    for (let key of this.Blocks)
      if (!this.MemoryOfBlocks[key]) this.MemoryOfBlocks[key] = new Memory();
  }

  static ReInit(expressions) {
    this.AllTheBlocks = expressions;
    this.Blocks = Object.keys(expressions);
    this.MemoryOfBlocks = {};
    for (let key of this.Blocks) this.MemoryOfBlocks[key] = new Memory();
  }

  static async Exec(block) {
    if (this.Blocks.includes(`pre-${block}`)) await this.Exec(`pre-${block}`);

    this.BlocksInUse.add(block);
    let ctx = { block: block };

    for (let i = 0; i < this.AllTheBlocks[block].length; i++) {
      try {
        await this.AllTheBlocks[block][i].Do(ctx);
      } catch (ex) {
        if (ex.message === "EXIT") throw ex; // Нормальный выход (equit)
        Terminal.println(
          `\n[ERROR] ${ex.message || "Unknown error"} at line ${i + 1} of block [${block}]`,
        );
        throw ex; // Прерываем цепочку
      }
    }

    if (!block.startsWith("crate-")) this.MemoryOfBlocks[block].Clean();
    this.BlocksInUse.delete(block);
  }

  static async Launch() {
    if (this.Blocks.includes("main")) {
      try {
        await this.Exec("main");
      } catch (e) {
        if (e.message !== "EXIT") console.error(e);
      }
    } else {
      Terminal.println("K0003: No main block found.");
    }
  }
}

/** ==========================================
 *  UI Логика
 *  ========================================== */
document
  .getElementById("clear-btn")
  .addEventListener("click", () => Terminal.clear());

document.getElementById("run-btn").addEventListener("click", async () => {
  const code = document.getElementById("code-editor").value;
  Terminal.clear();
  VirtualFS.write("main.kii", code);

  try {
    let rawTokens = Lexer.Tokenize(KiiBlockFinder.FindIn(code));
    let ast = Parser.Parse(rawTokens);
    Executor.ReInit(ast);
    await Executor.Launch();
    Terminal.println("\n[Program finished]");
  } catch (e) {
    Terminal.println("\n[Fatal Execution Error]");
  }
});
