Created by 胡威振, last modified on 一月 09, 2023

#   [YDBRD-8352 : DBMS_LOB.COMPARE Design（DBMS_LOB.COMPARE方案设计）](#ydbrd-8352--dbms-lobcompare-designdbms-lobcompare方案设计)  

SR链接：    [YDBRD-8352](https://jira.yasdb.com/browse/YDBRD-8352?src=confmacro)    -  支持DBMS_LOB.COMPARE  完成

##   [1. Overview（概述）](#1-overview概述)  

```
本设计方案是为了实现DBMS_LOB.COMPARE高级包，对齐Oracle 21。
这个高级包函数的功能是比较两个完整的lob或两个lob的一部分。
如果lob_1小于lob_2，则返回-1;如果大于lob_2，则返回 1;如果等于lob_2，则返回 0。

```

##   [2. Features（功能特性）](#2-features功能特性)  

- BLOB和CLOB的长度都可以达到4G，所以offset应为BIGINT类型。
- 如果两个lob参数一个是BLOB/RAW，另一个是CLOB/CHAR/VARCHAR，则报错。
- 当出现以下情况时，返回值为null：amount < 1、offset < 1、存在null参数。


```
定义：
DBMS_LOB.COMPARE (
   lob_1            IN BLOB,
   lob_2            IN BLOB,
   amount           IN BIGINT:= DBMS_LOB.LOBMAXSIZE,
   offset_1         IN BIGINT:= 1,
   offset_2         IN BIGINT:= 1)
  RETURN INTEGER;

DBMS_LOB.COMPARE (
   lob_1            IN CLOB  CHARACTER SET ANY_CS,
   lob_2            IN CLOB  CHARACTER SET lob_1%CHARSET,
   amount           IN BIGINT:= DBMS_LOB.LOBMAXSIZE,
   offset_1         IN BIGINT:= 1,
   offset_2         IN BIGINT:= 1)
  RETURN INTEGER;

```

|参数|类型|是否必填|默认值|说明|参数类型|
|---|---|---|---|---|---|
|lob_1|LOB|是|无|用于比较的第一个LOB参数|char、varchar、blob、clob、raw|
|lob_2|LOB|是|无|用于比较的第二个LOB参数。|char、varchar、blob、clob、raw|
|amount|BIGINT|否|Max(length(lob_1), length(lob_2))|用于比较的字节数(对于blob)或字符数(对于clob)。|tinyint、smallint、int、bigint、float、double、number、char、varchar， 对于不是bigint的参数，转成bigint并做截断处理|
|offset_1|BIGINT|否|1|用于比较的第一个LOB(orgin:1)上的字节或字符偏移量。|tinyint、smallint、int、bigint、float、double、number、char、varchar， 对于不是bigint的参数，转成bigint并做截断处理|
|offset_2|BIGINT|否|1|用于比较的第二个LOB(origin:1)上的字节或字符偏移量。|tinyint、smallint、int、bigint、float、double、number、char、varchar， 对于不是bigint的参数，转成bitint并做截断处理|


##   [3. Interfaces（接口）](#3-interfaces接口)  

```
bipVerifyCompare
bipExecCompare


```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 verify阶段](#51-verify阶段)  

###   [5.2 exec阶段](#52-exec阶段)  

```
static CodResult bipExecCompare(AnlStmt* stmt, ExprNode* node, Variant* retValue)
{
    Expr* argLob1 = node-&gt;args-&gt;head;
    Expr* argLob2 = argLob1-&gt;next;
    Variant varLob1, varLob2;
    CodUint64 amount, offset1 = 1, offset2 = 1;

    COD_CALL(execExpr(stmt,argLob1,&amp;varLob1));
    anlKeepStackVar(stmt, &amp;varLob1);
    COD_CALL(checkLobType(node, varLob1.type));

    COD_CALL(execExpr(stmt,argLob2,&amp;varLob2));
    anlKeepStackVar(stmt, &amp;varLob2);
    COD_CALL(checkLobType(node, varLob2.type));

    if (varLob1.isNull || varLob2.isNull) {
        varAsNull(retValue, node-&gt;dataType);
        return COD_SUCCESS;
    }

    if ((IS_CHAR_TYPE(varLob1.type) &amp;&amp; varLob2.type == DTYPE_CLOB) || (IS_RAW_TYPE(varLob1.type) &amp;&amp; varLob2.type == DTYPE_BLOB)) {
        COD_CALL(execVarConvertSafe(stmt, &amp;varLob1, varLob2.type));
        anlKeepStackVar(stmt, &amp;varLob1);
    }
    if ((IS_CHAR_TYPE(varLob2.type) &amp;&amp; varLob1.type == DTYPE_CLOB) || (IS_RAW_TYPE(varLob2.type) &amp;&amp; varLob1.type == DTYPE_BLOB)){
        COD_CALL(execVarConvertSafe(stmt, &amp;varLob2, varLob1.type));
        anlKeepStackVar(stmt, &amp;varLob2);
    }

    Expr* argExpr = argLob2-&gt;next;
    Variant argValue;
    if (argExpr != NULL) {
        COD_CALL(execExpr(stmt, argExpr, &amp;argValue));
        if (argValue.isNull) {
            varAsNull(retValue, node-&gt;dataType);
            return COD_SUCCESS;
        }
        COD_CALL(execVarConvertSafe(stmt, &amp;argValue, DTYPE_NUMBER));
        COD_CALL(codNumberToInt64Floor(&amp;argValue.vNumber, &amp;argValue.vInt64));
        if (argValue.vInt64 &lt; 1) {
            varAsNull(retValue, node-&gt;dataType);
            return COD_SUCCESS;
        }
        amount = argValue.vInt64;

        argExpr = argExpr-&gt;next;
        if (argExpr != NULL) {
            COD_CALL(execExpr(stmt,argExpr,&amp;argValue));
            if (argValue.isNull) {
                varAsNull(retValue, node-&gt;dataType);
                return COD_SUCCESS;
            }
            COD_CALL(execVarConvertSafe(stmt, &amp;argValue, DTYPE_NUMBER));
            COD_CALL(codNumberToInt64Floor(&amp;argValue.vNumber, &amp;argValue.vInt64));
            if (argValue.vInt64 &lt; 1) {
                varAsNull(retValue, node-&gt;dataType);
                return COD_SUCCESS;
            }
            offset1 = argValue.vInt64;

            argExpr = argExpr-&gt;next;
            if (argExpr != NULL) {
                COD_CALL(execExpr(stmt,argExpr,&amp;argValue));
                if (argValue.isNull) {
                    varAsNull(retValue, node-&gt;dataType);
                    return COD_SUCCESS;
                }
                COD_CALL(execVarConvertSafe(stmt, &amp;argValue, DTYPE_NUMBER));
                COD_CALL(codNumberToInt64Floor(&amp;argValue.vNumber, &amp;argValue.vInt64));
                if (argValue.isNull || argValue.vInt64 &lt; 1) {
                    varAsNull(retValue, node-&gt;dataType);
                    return COD_SUCCESS;
                }
                offset2 = argValue.vInt64;
            }
        }
    } else {
        amount = 0;
    }

    Variant subStr1, subStr2;
    subStr1.type = node-&gt;dataType;
    subStr2.type = node-&gt;dataType;

    if (IS_LOB_TYPE(varLob1.type) &amp;&amp; IS_LOB_TYPE(varLob2.type)) {
        CodUint64 len1, len2;
        COD_CALL(ankLobVarLength(stmt-&gt;handler-&gt;khdlr, &amp;varLob1.vLob,  varLob1.type, &amp;len1));
        COD_CALL(ankLobVarLength(stmt-&gt;handler-&gt;khdlr, &amp;varLob2.vLob,  varLob2.type, &amp;len2));
        amount = amount &lt; 1 ? MAX(len1, len2) : amount;
        retValue-&gt;vInt32 = 0;
        CodUint32 tempAmount;
        while (amount &gt; 0 &amp;&amp; retValue-&gt;vInt32 == 0) {
            tempAmount = (CodUint32)MIN(ANS_MAX_STRING_LEN, amount);
            ANL_SAVE_STACK;
            if (len1 &lt; offset1) {
                COD_CALL(getSubStr(stmt, varLob1, 0, 1, len1,&amp;subStr1));
            } else {
                COD_CALL(getSubStr(stmt, varLob1, tempAmount,  offset1, len1,&amp;subStr1));
            }
            if (len2 &lt; offset2) {
                COD_CALL(getSubStr(stmt, varLob2, 0, 1, len2, &amp;subStr2));
            } else {
                COD_CALL(getSubStr(stmt, varLob2, tempAmount, offset2, len2, &amp;subStr2));
            }
            amount -= tempAmount;
            offset1 += tempAmount;
            offset2 += tempAmount;
            retValue-&gt;vInt32 = codTextCompare(&amp;subStr1.vText, &amp;subStr2.vText, CASE_SENS, ANL_VARENV-&gt;charset);
            ANL_RESTORE_STACK;
        }
    } else {
        if (amount &lt; 1) {
            amount = MAX(varLob1.vText.len, varLob2.vText.len);
        }
        codTextSubstr(&amp;varLob1.vText, (CodUint32)offset1 - 1, (CodUint32)amount, &amp;subStr1.vText, ANL_VARENV-&gt;charset);
        codTextSubstr(&amp;varLob2.vText, (CodUint32)offset2 - 1, (CodUint32)amount, &amp;subStr2.vText, ANL_VARENV-&gt;charset);
        if (IS_RAW_TYPE(varLob1.type) &amp;&amp; IS_RAW_TYPE(varLob2.type)) {
            codBytesCompare(&amp;subStr1.vBytes, &amp;subStr2.vBytes, &amp;retValue-&gt;vInt32);
        } else {
            retValue-&gt;vInt32 = codTextCompare(&amp;subStr1.vText, &amp;subStr2.vText, CASE_SENS, ANL_VARENV-&gt;charset);
        }
    }

    retValue-&gt;type = node-&gt;dataType;
    return COD_SUCCESS;
}

```

- 代码类似substr，从两个lob里各取一小段比较，如果相等，再取一小段比较。


###   [5.3 Architecture（架构）](#53-architecture架构)  

###   [5.4 Data Structures & Flow（数据结构与流程）](#54-data-structures--flow数据结构与流程)  

###   [5.5 Compatibility（兼容性）](#55-compatibility兼容性)  

###   [5.6 DFX设计](#56-dfx设计)  

###   [5.5 其他](#55-其他)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

```
1、null测试。
2、类型测试。
3、结果范围测试。

```

##   [7.资料设计章节](#7资料设计章节)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  