Created by 胡威振, last modified on 十二月 28, 2022

#   [YDBRD-8351 : DBMS_LOB.SUBSTR Design（DBMS_LOB.SUBSTR 方案设计）](#ydbrd-8351--dbms-lobsubstr-designdbms-lobsubstr-方案设计)  

SR链接：    [YDBRD-8351](https://jira.yasdb.com/browse/YDBRD-8351?src=confmacro)    -  支持DBMS_LOB.SUBSTR功能  完成

##   [1. Overview（概述）](#1-overview概述)  

```
本设计方案是为了实现DBMS_LOB.COMPARE高级包，对齐Oracle 21。
该函数返回一个从offset开始，amount个字节或字符的LOB。

```

##   [2. Features（功能特性）](#2-features功能特性)  

- YashanDB字符串最长为ANS_MAX_STRING_LEN(32000)
- BLOB和CLOB的长度都可以达到4G，所以offset的类型应为BIGINT。
- 当出现一下情况时函数返回NULL：amount < 1、amount > 32000、offset < 1、参数存在null。
- 当输入的第一个参数是BLOB或RAW时，返回值类型为RAW，当输入的第一个参数是CLOB、CHAR、VARCHAR时，返回值类型为VARCHAR2。


```
定义：
DBMS_LOB.SUB_STR (
   lob_loc     IN    BLOB,
   amount      IN    INTEGER := 32000,
   offset      IN    BIGINT:= 1)
  RETURN RAW;

DBMS_LOB.SUB_STR (
   lob_loc     IN    CLOB   CHARACTER SET ANY_CS,
   amount      IN    INTEGER := 32000,
   offset      IN    BIGINT:= 1)
  RETURN VARCHAR2 CHARACTER SET lob_loc%CHARSET;


```

|参数|类型|是否必填|默认值|说明|参数类型|
|---|---|---|---|---|---|
|lob|LOB|是|无|要读取的LOB参数|blob、clob、char、varchar、raw|
|amount|INTEGER|否|32000|要读取的字节数(对于blob)或字符数(对于clob)。|tinyint、smallint、int、bigint、float、double、number、char、varchar， 对于不是int的参数，转成int并做截断处理|
|offset|BIGINT|否|1|以字节(对于blob)或字符(对于clob)为单位从LOB开始的偏移量(原点:1)。|tinyint、smallint、int、bigint、float、double、number、char、varchar， 对于不是bigint的参数，转成bigint并做截断处理|


##   [3. Interfaces（接口）](#3-interfaces接口)  

```
bipVerifySubStr
bipExecSubStr


```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 verify阶段](#51-verify阶段)  

###   [5.2 exec阶段](#52-exec阶段)  

```
static CodResult bipExecSubStr(AnlStmt* stmt, ExprNode* node, Variant* retValue)
{
    Expr* argExpr = node-&gt;args-&gt;head;
    Variant varLob;
    argExpr = argExpr-&gt;next;
    COD_CALL(execExpr(stmt, argExpr, &amp;varLob));
    Variant argValue;
    COD_CALL(execExpr(stmt, argExpr, &amp;argValue));
    CodUint32 amount = argValue.vInt32;
    argExpr = argExpr-&gt;next;
    COD_CALL(execExpr(stmt, argExpr, &amp;argValue));
    CodUint64 offset = argValue.vInt64;


    CodUint64   readSize;
    CodUint64   offsetB = 0;
    VarLobHead* srcLobHead = ((VarLobHead*)varLob.vLob.data);
    CodBool     isMultiChar = (srcLobHead-&gt;charLen == 0); // 是否为多字节字符， blob可以认为是单字节字符
    CodUint32   readMblen = (isMultiChar ? CHARSET_MAX_WORD_CHAR_LEN : 1);

    CodUint32 bufSize = MIN(ANS_MAX_STRING_LEN, amount * CHARSET_MAX_WORD_CHAR_LEN);
    ANL_SAVE_STACK;
    COD_CALL(anlPush(stmt, bufSize, (CodChar**)&amp;retValue-&gt;vText.str));
    if (isMultiChar) {
        COD_CALL(ankVarLobLocatePos(stmt-&gt;handler-&gt;khdlr, &amp;varLob.vLob, offset, &amp;offsetB));
    } else {
        offsetB = offset;
    }

    readSize = bufSize; // readSize是出入参，最大读bufSize字节，返回实际读到的字节数
    COD_CALL(ankVarLobRead(stmt-&gt;handler-&gt;khdlr, &amp;varLob.vLob, offsetB, &amp;readSize, retValue-&gt;vText.str));

    if (isMultiChar) {
        CodUint64   subOffset = amount;
        CodUint32   subPos;
        // 调下面这个函数，subPos最后会返前subOffset个字符的字节数。最终的retValue需要根据它来调整长度，避免返回半个字节
        COD_CALL(codTextLengthUntil(&amp;retValue-&gt;vText, ANL_VARENV-&gt;charset, &amp;subOffset, &amp;subPos));
        retValue-&gt;vText.len = subPos;
    } else {
        retValue-&gt;vText.len = readSize;
    }
    ANL_RESTORE_STACK;
    return COD_SUCCESS;
}


```

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