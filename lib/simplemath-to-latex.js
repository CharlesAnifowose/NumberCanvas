var SimpleMathToLatex = {
    convert: function (str, centered) {
        var group = SimpleMathToLatex.parseMathExpression(str);
        var latexExpression = SimpleMathToLatex.outputLatex(group, false);
        if (centered){
            latexExpression = '\\[' +latexExpression+ '\\]';
        }
        else{
            latexExpression = '\\(' +latexExpression+ '\\)';
        }
        return latexExpression;
    },
    convertChain: function (arr) {
        var returnChain = [];
        returnChain.push( '\\begin{align}' );
        var len = arr.length;
        for (var i=0; i<len; i++){
            var group = SimpleMathToLatex.parseMathExpression(arr[i]);
            var latex = SimpleMathToLatex.outputLatex(group, true)
            if (latex.search('&=') === -1) latex = '& \\quad '+latex;
            latex += '\\\\' // this is just two escapers, not 4
            returnChain.push(latex)
        }
        returnChain.push( '\\end{align}' );
        return returnChain.join('\n')
    },
    outputLatex:function (group, chain){
        var escaper = '\\';
        var terms = parseList(group.list);
        return terms.join(' ');
        
        function parseList(list){
            var terms = []; 
            var firstEqualUsed = false;
            var len = list.length;
            for (var i=0; i<len; i++){
                var node = list[i]
                switch (node.type){
                    case 'word':
                        push(node.val)
                    break;
                    case 'number':
                        push(node.val)
                    break;
                    // comma
                    case 'comma':
                        push(',')
                    break;
                    // operators
                    case 'multiply':
                        push(escaper+'times')
                    break;
                    case 'dotproduct':
                        push(escaper+'cdot')
                    break;
                    case 'plusminus':
                        push(escaper+'pm')
                    break;
                    case 'divide':
                        push(escaper+'div')
                    break;
                    case 'add':
                        push('+')
                    break;
                    case 'subtract':
                        push('-')
                    break;
                    case 'equal':
                        if (chain && !firstEqualUsed){
                            push('&=')
                            firstEqualUsed = true;
                        }
                        else{
                            push('=')
                        }
                    break;
                    case 'less than or equal':
                        push(escaper+'le')
                    break;
                    case 'greater than or equal':
                        push(escaper+'ge')
                    break;
                    case 'approximately':
                        push(escaper+'approx')
                    break;
                    case 'symbol':
                        push(escaper+node.val)
                    break;
                    // groups
                    case 'function':
                        //console.log(node, node.functionType);
                        switch (node.functionType){
                            case 'fraction':
                            case 'frac':
                                push(escaper+'cfrac');
                                push('{');
                                pushMultiple( parseList(node.params[0]) )
                                push('}');
                                push('{');
                                pushMultiple( parseList(node.params[1]) )
                                push('}');
                            break;
                            case 'abs':
                                push('|');
                                pushMultiple( parseList(node.params[0]) )
                                push('|');
                            break;
                            case 'sqrt':
                                push(escaper+'sqrt');
                                push('{');
                                pushMultiple( parseList(node.params[0]) )
                                push('}');
                            break;
                            case 'int':
                                push(escaper+'int');
                                push('{');
                                pushMultiple( parseList(node.params[0]) )
                                push('}');
                            break;
                            
                            // the following are more like shorthand functions
                            case 'pow':
                            case 'exponent':
                            case 'exp':
                            case 'super':
                            case 'sup':
                                push('{');
                                pushMultiple( parseList(node.params[0]) )
                                push('}');
                                push('^');
                                push('{');
                                pushMultiple( parseList(node.params[1]) )
                                push('}');
                            break;
                            case 'subscript':
                            case 'sub':
                                push('{');
                                pushMultiple( parseList(node.params[0]) )
                                push('}');
                                push('_');
                                push('{');
                                pushMultiple( parseList(node.params[1]) )
                                push('}');						
                            break;

                            default:
                                console.error('Could not find function type. ', node)
                            break;
                        }
                    break;
                    case 'group':
                        push('{');
                        pushMultiple( parseList(node.list) )
                        push('}');	
                    break;
                    case 'round_bracket':
                        push(escaper+'left(');
                        pushMultiple( parseList(node.list) )
                        push(escaper+'right)');				
                    break;
                    case 'text':
                        push(escaper+'text');
                        push('{');
                        pushMultiple( parseList(node.list) )
                        push('}');
                    break;
                    default:
                        console.error('Could not identify type. ', node)
                    break;
                }
            }
            
            return terms;
            
            function push(val){
                terms.push(val)
            }
            function pushMultiple(arr){
                var len = arr.length;
                for (var i=0; i<len; i++){
                    var val = arr[i]
                    terms.push(val)
                }
            }
        }
    },
    parseMathExpression: function (str){
        str += '  '; // this makes it so that the loop automatically closes the last action
        var len = str.length;
        var activeGroup = {list:[]};
        var activeWordChain;
        var activeNumberChain;
        var characterEscapeMode = false; 

        var knownFunctions = {
             'exp': true
            ,'exponent': true
            ,'pow': true
            ,'sqrt': true
            ,'frac': true
            ,'fraction': true
            ,'int': true
            ,'mod': true
            ,'abs': true
            ,'text': true
        }
        
        for (var i=0; i<len; i++){
            var character = str[i];
            
            // during a text block, don't apply any styling, just add characters
            if (activeGroup.type === 'text'){
                if (character === '\"'){
                    wordChainEnd()
                    closeCurrentGroup();
                    continue;
                }
                else{
                    wordChainContinue(character);
                    continue;
                }
            }

            // basic character check
            var is = {}
            if (character.match(/[a-zA-Z]/)){
                is['letter'] = true;
            }
            else if (character.match(/[0-9.]/)){
                is['number'] = true;
            }
            
            // close ongoing chains as required (yes, a little duplication with what follows, but order matters)
            if (activeWordChain){
                if (!is['letter']){
                    wordChainEnd()
                }
            }
            if (activeNumberChain){
                if (!is['number']){
                    numberChainEnd()
                }
            }
            
            // first check to see if there is already something happening
            if (activeGroup.joiner){
                // keep shoving whatever is in the list and make it into a parameter
                if (activeGroup.list.length > 1){
                    console.error ('activeGroup is accumulating too many terms too fast')
                    throw new Error(activeGroup)
                }
                else if (activeGroup.list.length == 1){
                    
                    // very special rule of exclusion
                    var shouldCancelRoundBracket = true;
                    if (activeGroup.functionType === 'exp' && activeGroup.params.length === 0){
                        shouldCancelRoundBracket = false

                    }
                    if (shouldCancelRoundBracket) activeGroup.list[0] = cancelRoundBracket(activeGroup.list[0]);

                    activeGroup.params.push(activeGroup.list);
                    activeGroup.list = [];
                }
                // close group when you have 2 paramaters
                if (activeGroup.params.length == 2){
                    closeCurrentGroup()
                }
                else if (activeGroup.params.length > 2){
                    console.error ('activeGroup is accumulating too many terms too fast')
                    throw new Error(activeGroup)
                }
            }
            
            // Extend word / number chains as appropriate
            if (activeWordChain){
                if (is['letter']){
                    wordChainContinue(character);
                    continue;
                }
            }
            if (activeNumberChain){
                if (is['number']){
                    numberChainContinue(character);
                    continue;
                }
            }
            
            // check for beginning of number / word chain
            if (is['letter']){
                wordChainStart(character)
                continue;
            }
            if (is['number']){
                numberChainStart(character)
                continue;
            }
            
            /* I think I should be checking for the closure of shorthand groups here as well */
            
            // Check for pipe symbol
            if (character === '|'){
                wordChainStart('|');
                continue;
            }

            // check for bracket
            if (character === '('){
                var lastTerm = getLastTerm();
                if (lastTerm && lastTerm.type === 'word' && knownFunctions[lastTerm.val] ){
                    var lastTermVal = lastTerm.val;
                    absorbLastTermGroup();
                    functionGroupStart({
                        functionType:lastTerm.val, 
                        absorbLastTerm: false
                    });
                }
                else{
                    var newGroup = {parent:activeGroup, list:[], type:'round_bracket'};
                    activeGroup = newGroup;
                }
                continue;
            }
            if (character === ')'){
                closeCurrentGroup();
                continue;
            }

            // check for quotes, which is the character escape mechanism
            if (character === '\"'){
                // quotes are closed at the beginning of the loop (because everything else is escaped at that point)
                var newGroup = {parent:activeGroup, list:[], type:'text'};
                activeGroup = newGroup;
                wordChainStart()
                continue;
            }

            // comma
            if (character===','){
                if (activeGroup.type === 'function'){
                    pushFunctionParam(activeGroup)
                }
                else{
                    addTerm('comma');
                }
                continue;
            }
            
            // check for shorthand function
            if (character==='/'){ 
                functionGroupStart({
                      functionType:   'frac'
                    , absorbLastTerm: true
                    , joiner:         true
                    , hideBracket:    true
                });
                continue
            }
            if (character==='^'){ // superscript / exponent
                functionGroupStart({
                      functionType:   'exp'
                    , absorbLastTerm: true
                    , joiner:         true
                    , hideBracket:    false
                });
                continue
            }
            if (character==='_'){ //subscript
                functionGroupStart({
                      functionType:   'sub'
                    , absorbLastTerm: true
                    , joiner:         true
                    , hideBracket:    true
                });
                continue		
            }
            
            // check for operators
            if (character==='*'){
                addTerm('multiply');
                continue;
            }
            if (character==='+'){
                addTerm('add');
                continue;
            }
            if (character==='-'){
                addTerm('subtract');
                continue;
            }
            if (character==='='){
                addTerm('equal');
                continue;
            }
            
            // else
            if (character===' '){
                continue;
            }
            addTerm('symbol', character);

        }

        // Spit out the object
        return activeGroup;
        
        // list functions
        function addTerm(type, val){
            activeGroup.list.push({ type:type, val: val });		
        }
        function getLastTerm(){
            var i = activeGroup.list.length - 1;
            return activeGroup.list[i];
        }
        function absorbLastTermGroup(){
            var term = activeGroup.list.pop();
            //console.log ('absorbing', term)
            return term;
        }
        function cancelRoundBracket(term){
            if (term.type == 'round_bracket'){
                term.type = 'group';
            }
            return term;
        }
        function pushFunctionParam(group){
            group.params.push(group.list);
            group.list = []
        }
        function functionGroupStart(params){
            if (!params) params = {};
            // functionType, absorbLastTerm, joiner, hideBracket
            var newGroup = {parent:activeGroup, type:'function', list:[], params:[],  functionType:params.functionType, joiner:params.joiner };
            if (params.absorbLastTerm){
                var lastTerm = absorbLastTermGroup()
                if (params.hideBracket) lastTerm = cancelRoundBracket(lastTerm)
                newGroup.list.push( lastTerm );
            }
            activeGroup = newGroup;
        }
        function closeCurrentGroup(){
            var oldGroup = activeGroup;
            if (oldGroup.type === 'function'){
                pushFunctionParam(oldGroup)
            }
            activeGroup = oldGroup.parent;
            activeGroup.list.push(oldGroup);
        }
        // word chain functions
        function wordChainStart(val){
            var arr = [];
            if (val !== undefined){
                arr.push(val)
            }
            activeWordChain = arr;
        }
        function wordChainContinue(val){
            activeWordChain.push(val);
        }
        function wordChainEnd(){
            addTerm('word', activeWordChain.join('') );
            activeWordChain = null;
        }
        
        // number chain functions
        function numberChainStart(val){
            activeNumberChain = [val];
        }
        function numberChainContinue(val){
            activeNumberChain.push(val);
        }
        function numberChainEnd(){
            addTerm( 'number', activeNumberChain.join('') );
            activeNumberChain = null;
        }
    }
}