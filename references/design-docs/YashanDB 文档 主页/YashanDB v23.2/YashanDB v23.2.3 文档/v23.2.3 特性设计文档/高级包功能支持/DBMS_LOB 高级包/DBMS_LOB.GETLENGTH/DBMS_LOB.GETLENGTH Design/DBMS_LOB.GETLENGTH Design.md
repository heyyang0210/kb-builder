Created by 胡威振, last modified on 十二月 28, 2022

#   [YDBRD-8349 : DBMS_LOB.GETLENGTH Design（DBMS_LOB.GETLENGTH 方案设计）](#ydbrd-8349--dbms-lobgetlength-designdbms-lobgetlength-方案设计)  

SR链接：    [YDBRD-8349](https://jira.yasdb.com/browse/YDBRD-8349?src=confmacro)    -  支持DBMS_LOB.GETLENGTH函数  完成

  


##   [1. Overview（概述）](#1-overview概述)  

```
本设计方案是为了实现DBMS_LOB.COMPARE高级包，对齐Oracle 21。
该高级包函数获取指定 LOB 的长度。返回以字节或字符为单位的长度。

```

##   [2. Features（功能特性）](#2-features功能特性)  

- 只接受一个参数，参数类型为blob、clob、char、varchar、raw类型，返回lob的字节或字符长度。
- blob和clob的长度都可以达到4G，返回值类型为BIGINT。
- 如果输入为Null，则输出为Null。


```
定义：
DBMS_LOB.GET_LENGTH (
   lob_loc    IN  BLOB) 
  RETURN BIGINT;
 
DBMS_LOB.GET_LENGTH (
   lob_loc    IN  CLOB   CHARACTER SET ANY_CS) 
  RETURN BIGINT; 


```

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
bipVerifyGetLength
bipExecGetLength

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 verify阶段](#51-verify阶段)  

```
static CodResult bipVerifyGetLength(AnlVerifier* vrfr, ExprNode* node)
{
    Expr* argExpr = (Expr*)node-&gt;args-&gt;head;

    adjustUnknownExprNode(vrfr-&gt;stmt,DTYPE_CLOB,DTYPE_CLOB,argExpr-&gt;root);
    if (!IS_LOB_TYPE(argExpr-&gt;root-&gt;dataType) &amp;&amp; !IS_CHAR_TYPE(argExpr-&gt;root-&gt;dataType) &amp;&amp; !IS_RAW_TYPE(argExpr-&gt;root-&gt;dataType)) {
        COD_SYNTAX_ERROR(node-&gt;pos, ERR_ANS_EXEC_DATA_TYPE_MISMATCH, "LOB|CHAR|VARCHAR|RAW", TYPE_NAME(argExpr-&gt;root-&gt;dataType));
        return COD_ERROR;
    }
    node-&gt;dataType = DTYPE_BIGINT;
    node-&gt;evalSize = TYPE_SIZE(node-&gt;dataType);
    return COD_SUCCESS;
}

```

###   [5.2 exec阶段](#52-exec阶段)  

- 调用存储层接口ankLobVarLength计算长度，对于CLOB，返回的是字符长度，BLOB返回字节长度.


```
static CodResult bipExecGetLength(AnlStmt* stmt, ExprNode* node, Variant* retValue)
{
    Expr*   argExpr = node-&gt;args-&gt;head;
    Variant argValue;
    COD_CALL(execExpr(stmt, argExpr, &amp;argValue));

    if (argValue.isNull) {
        varAsNull(retValue, DTYPE_BIGINT);
        return COD_SUCCESS;
    }

    if (IS_LOB_TYPE(argValue.type)) {
        COD_CALL(ankLobVarLength(stmt-&gt;handler-&gt;khdlr, &amp;argValue.vLob, argValue.type, (CodUint64*)&amp;retValue-&gt;vInt64));
    } else {
        Variant varText;
        varText.vText = EMPTY_TEXT;
        COD_SYNTAX_CALL(varConvert(ANL_VARENV, &amp;argValue, &amp;varText, DTYPE_VARCHAR), argExpr-&gt;root-&gt;pos);
        retValue-&gt;vInt64 = codTextLength(&amp;varText.vText, ANL_VARENV-&gt;charset);
    }

    if (argValue.type == DTYPE_RAW) {
        retValue-&gt;vInt64 = retValue-&gt;vInt64 / 2;
    }

    retValue-&gt;type = DTYPE_BIGINT;
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