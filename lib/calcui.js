// Initialize CodeMirror instance
  var editor = CodeMirror.fromTextArea(document.getElementById("code"), {
    theme: 'neat',
    historyEventDelay: 250,
    styleActiveLine: true,
    highlightSelectionMatches: true,
    matchBrackets: true,
    extraKeys: {
        'Enter': function(doc){
            // move to end of line
            var currentCursor = doc.getCursor('end'); //{line, ch}
            var currentLine = doc.getLine(currentCursor.line) // string
            if (currentCursor.ch != 0 ){
                doc.setCursor(currentCursor.line, currentLine.length)
            }
            // insert new line
            doc.replaceSelection('\n', "end", "+input");
        },
        'Shift-Enter': function(doc){
            // move to start of line
            var currentCursor = doc.getCursor('start'); //{line, ch}
            var currentLine = doc.getLine(currentCursor.line) // string
            doc.setCursor(currentCursor.line, 0)
            // insert new line
            doc.replaceSelection('\n', "start", "+input");
        }
    }
  });


// Setup line change events
var errorString = '!ERROR';
var backgroundChangeMode = false;

var intevalMemory = []
intevalMemory[0] = {
  ans:0,
  answer:0,
  prev:0,
  previous:0
};

function foreach(arr, callback){
    for (i in arr){
        callback(arr[i],i)
    }
}
function calculateLines(params){
    if (backgroundChangeMode) return;
    backgroundChangeMode = true
    
    if (!params){
        params = {};
    }

    // lines that were changed
    var concernedLinesMap = {};
    foreach (changeBufferList, function(changeObj){
        concernedLinesMap[changeObj.from.line] = true;
    });
    changeBufferList = [];
    var startLine = params.startLine;
    foreach (concernedLinesMap, function(flag, lineNumber){
        lineNumber = Number(lineNumber);
        if (startLine === undefined || lineNumber < startLine){
            startLine = lineNumber;
        }
    })
    // move startLine by increments of 10
    var startStep = Math.floor(startLine/10);
    if (startStep > intevalMemory.length -1){
        startStep = intevalMemory.length - 1;
    }
    startLine = Math.round( startStep*10 );

    // get original cursor so that you can set it back
    var cursor = editor.getCursor();
    
    // start with some original assigned values
    var assignedValues = {};
    var intervalValues = intevalMemory[startStep]
    foreach(intervalValues, function(value,i){
        assignedValues[i] = value;
    });
    
    // Cycle through changed lines
    var len = editor.lineCount();
    for (var lineNumber=startLine; lineNumber<len; lineNumber++){

        // save values
        if ( (lineNumber > 0) && (lineNumber % 10 === 0) ){
            var intervalValues = {}
            foreach(assignedValues, function(value,i){
                intervalValues[i] = value;
            });
            var currentStep = Math.round(lineNumber/10);
            intevalMemory[currentStep] = intervalValues;
        }

        var lineStr = editor.getLine(lineNumber);
        var originalLineStr = lineStr;
        if ($.trim(lineStr) != ''){
            lineStr = parseLineContents(lineStr, assignedValues);
            if (originalLineStr !== lineStr){
                // update line
                editor.setLine(lineNumber, lineStr);
            }

        }
    }
    
    // set cursor back
    editor.setCursor(cursor)

    // unlock changes
    backgroundChangeMode = false;
}

function parseLineContents(lineStr, assignedValues){
    var lineContents = lineStr.split('=');
    var varsForAssignment = []
    var lineReturn = [];
    var val
    var len = Math.min(2, lineContents.length)
    var skipAppend = false;
    
    // Parse calculation / assignment
    for (var i=0; i<len; i++){
        var expressionStr = lineContents[i];
        lineReturn.push(expressionStr);
        
        expressionStr = $.trim(expressionStr);
        if (expressionStr=='') continue; 
        try {
            var expression = Parser.parse(expressionStr);
        }
        catch (e) {
            if (console){ 
                console.log ('evaluation failed on line '+(i+1));
            }
        }
        
        if (expression){
            if ( isComplexExpression(expression) ){
                try {
                    val = expression.evaluate(assignedValues);
                }
                catch (e){
                    if (console){ 
                        console.log ('evaluation failed on line '+(i+1));
                    }
                }
                break;
            }
            else{
                if (i==len-1){
                    val = parseFloat(expressionStr);
                    if ( isNaN(val) ){
                        val = assignedValues[expressionStr];
                    }
                    else{
                        skipAppend = true
                    }
                }
                else{
                    varsForAssignment.push(expressionStr);
                }
            }
        }
    }
    if (val != undefined){
        assignValueToVars(val, assignedValues, varsForAssignment)
        var valStr = String(Number(Number(val).toFixed(9)));
        if (!skipAppend) lineReturn.push(' '+valStr )
        // '20'+ String.fromCharCode(8196) + '000'+ String.fromCharCode(8196) + '000'  // One-third em space: this is how you do large number display without using commas or full-sized spaces 
    }
    return lineReturn.join('=')
}
function assignValueToVars(val, varObj, varNameList){
    var len = varNameList.length
    for (var i=0; i<len; i++){
    var varName = varNameList[i]
        varObj[varName] = val;
    }
}
function isComplexExpression(expression){
    return !(expression.tokens.length == 1);
}

// Editor cursor move event
editor.on("cursorActivity", function(doc){
    var lineNumber = doc.getCursor().line;
    var lineContents = editor.getLine(lineNumber);
    var latexExpression = SimpleMathToLatex.convert(lineContents);
    $('#mathpreview').html( latexExpression );
    MathJax.Hub.Queue(
      ["Typeset", MathJax.Hub, $('#mathpreview')[0]]
    );
});

// Editor change event
var typingBuffer, changeBufferList=[];
editor.on('change', function(doc, changeObj){
    if(typingBuffer !== undefined) clearTimeout(typingBuffer);
    changeBufferList.push(changeObj);
    typingBuffer = setTimeout(calculateLines, 300); // CoeMirror's historyEventDelay is 500 milliseconds, so this buffer allows the history to be saved first
})


calculateLines({startLine:0})