(function() {
  var chapter, chapterList, chapterName, chapterOrder, destination, docco_styles, docco_template, ensure_directory, exec, ext, file, fileStr, foundChapter, fs, generate_documentation, generate_html, get_language, highlight, highlight_end, highlight_start, l, languages, parse, parseKey, path, showdown, sources, spawn, template, _i, _j, _len, _len2, _ref;
  generate_documentation = function(source, callback) {
    return fs.readFile(source, "utf-8", function(error, code) {
      var sections;
      if (error) {
        throw error;
      }
      sections = parse(source, code);
      return highlight(source, sections, function() {
        generate_html(source, sections);
        return callback();
      });
    });
  };
  parse = function(source, code) {
    var code_text, docs_text, has_code, language, line, lines, save, section_name, sections, _i, _len;
    lines = code.split('\n');
    sections = [];
    language = get_language(source);
    has_code = docs_text = code_text = section_name = '';
    save = function(docs, code) {
      return sections.push({
        docs_text: docs,
        code_text: code
      });
    };
    for (_i = 0, _len = lines.length; _i < _len; _i++) {
      line = lines[_i];
      if (line.match(language.comment_matcher) && !line.match(language.comment_filter)) {
        if (has_code) {
          save(docs_text, code_text);
          has_code = docs_text = code_text = '';
        }
        docs_text += line.replace(language.comment_matcher, '') + '\n';
      } else {
        has_code = true;
        code_text += line + '\n';
      }
    }
    save(docs_text, code_text);
    return sections;
  };
  highlight = function(source, sections, callback) {
    var language, output, pygments, section;
    language = get_language(source);
    pygments = spawn('pygmentize', ['-l', language.name, '-f', 'html', '-O', 'encoding=utf-8']);
    output = '';
    pygments.stderr.addListener('data', function(error) {
      if (error) {
        return console.error(error);
      }
    });
    pygments.stdout.addListener('data', function(result) {
      if (result) {
        return output += result;
      }
    });
    pygments.addListener('exit', function() {
      var fragments, i, section, _len;
      output = output.replace(highlight_start, '').replace(highlight_end, '');
      fragments = output.split(language.divider_html);
      for (i = 0, _len = sections.length; i < _len; i++) {
        section = sections[i];
        section.code_html = highlight_start + fragments[i] + highlight_end;
        section.docs_html = showdown.makeHtml(section.docs_text);
      }
      return callback();
    });
    pygments.stdin.write(((function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = sections.length; _i < _len; _i++) {
        section = sections[_i];
        _results.push(section.code_text);
      }
      return _results;
    })()).join(language.divider_text));
    return pygments.stdin.end();
  };
  generate_html = function(source, sections) {
    var dest, html, title;
    title = path.basename(source);
    dest = destination(source);
    html = docco_template({
      title: title,
      sections: sections,
      sources: sources,
      path: path,
      destination: destination,
      chapters: chapterList
    });
    console.log("docco: " + source + " -> " + dest);
    return fs.writeFile(dest, html);
  };
  fs = require('fs');
  path = require('path');
  showdown = require('./../vendor/showdown').Showdown;
  _ref = require('child_process'), spawn = _ref.spawn, exec = _ref.exec;
  languages = {
    '.coffee': {
      name: 'coffee-script',
      symbol: '#',
      comment: '#'
    },
    '.js': {
      name: 'javascript',
      symbol: '//',
      comment: '//'
    },
    '.rb': {
      name: 'ruby',
      symbol: '#',
      comment: '#'
    },
    '.py': {
      name: 'python',
      symbol: '#',
      comment: '#'
    },
    '.as': {
      name: 'actionscript',
      symbol: '(//|\\\*/|/\\\*\\\*|/\\\*|\\\*)',
      comment: '//'
    }
  };
  for (ext in languages) {
    l = languages[ext];
    l.comment_matcher = new RegExp('^\\s*' + l.symbol + '\\s?');
    l.comment_filter = new RegExp('(^#![/]|^\\s*#\\{|\\\@docco\\\-chapter|\\\@docco\\\-order)');
    l.divider_text = '\n' + l.comment + 'DIVIDER\n';
    l.divider_html = new RegExp('\\n*<span class="c1?">' + l.comment + 'DIVIDER<\\/span>\\n*');
  }
  get_language = function(source) {
    return languages[path.extname(source)];
  };
  destination = function(filepath) {
    return 'docs/' + path.basename(filepath, path.extname(filepath)) + '.html';
  };
  ensure_directory = function(callback) {
    return exec('mkdir -p docs', function() {
      return callback();
    });
  };
  template = function(str) {
    return new Function('obj', 'var p=[],print=function(){p.push.apply(p,arguments);};' + 'with(obj){p.push(\'' + str.replace(/[\r\t\n]/g, " ").replace(/'(?=[^<]*%>)/g, "\t").split("'").join("\\'").split("\t").join("'").replace(/<%=(.+?)%>/g, "',$1,'").split('<%').join("');").split('%>').join("p.push('") + "');}return p.join('');");
  };
  docco_template = template(fs.readFileSync(__dirname + '/../resources/docco.jst').toString());
  docco_styles = fs.readFileSync(__dirname + '/../resources/docco.css').toString();
  highlight_start = '<div class="highlight"><pre>';
  highlight_end = '</pre></div>';
  sources = process.ARGV;
  if (sources.length === 0) {
    console.log("No files to convert!");
    return;
  }
  chapterList = [];
  parseKey = function(buffer, key) {
    var keyEndIdx, keyIdx;
    keyIdx = fileStr.indexOf(key);
    if (keyIdx < 0) {
      return null;
    }
    keyEndIdx = fileStr.indexOf("\n", keyIdx);
    if (keyEndIdx < keyIdx) {
      keyEndIdx = fileStr.length;
    }
    return fileStr.substring(keyIdx + key.length, keyEndIdx).trim();
  };
  for (_i = 0, _len = sources.length; _i < _len; _i++) {
    file = sources[_i];
    fileStr = fs.readFileSync(file).toString();
    chapterName = parseKey(fileStr, "@docco-chapter");
    chapterOrder = parseKey(fileStr, "@docco-order");
    if (chapterName === null) {
      console.log("Warning: " + file + " has no @docco-chapter entry.");
    }
    foundChapter = null;
    for (_j = 0, _len2 = chapterList.length; _j < _len2; _j++) {
      chapter = chapterList[_j];
      if (chapter.title === chapterName) {
        foundChapter = chapter;
        break;
      }
    }
    if (foundChapter === null) {
      foundChapter = {
        title: chapterName,
        pages: []
      };
      chapterList.push(foundChapter);
    }
    foundChapter.pages.push({
      path: file,
      order: chapterOrder
    });
    foundChapter.pages.sort(function(a, b) {
      var _ref2;
      return (_ref2 = a.order > b.order) != null ? _ref2 : {
        1: -1
      };
    });
  }
  ensure_directory(function() {
    var args, next_arg;
    fs.writeFile('docs/docco.css', docco_styles);
    args = sources.slice(0);
    next_arg = function() {
      var a;
      if (args.length) {
        a = args.shift();
        if (!get_language(a)) {
          console.log("Warning: can't identify language for " + a + ", skipping...");
          return next_arg();
        }
        return generate_documentation(a, next_arg);
      }
    };
    return next_arg();
  });
}).call(this);
