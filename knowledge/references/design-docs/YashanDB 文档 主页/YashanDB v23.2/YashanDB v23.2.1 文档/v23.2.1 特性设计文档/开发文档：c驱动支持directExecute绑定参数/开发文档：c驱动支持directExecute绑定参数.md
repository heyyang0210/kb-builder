Created by 刘亮杰, last modified on 十月 24, 2023

# c驱动支持directExecute绑定参数

SR：

  [YDBRD-18447](https://jira.yasdb.com/browse/YDBRD-18447?src=confmacro)    -  c驱动支持directExecute绑定参数  完成    [YDBRD-21447](https://jira.yasdb.com/browse/YDBRD-21447?src=confmacro)    -  【c驱动】支持directExecute绑定参数  完成    [YDBRD-21751](https://jira.yasdb.com/browse/YDBRD-21751?src=confmacro)    -  【c驱动】支持directExecute绑定参数  完成

  


##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#1-overview%E6%A6%82%E8%BF%B0)  

需求来源：  嘉实基金POC

场 景：  directExecute支持绑定参数

需求描述：  directExecute支持绑定参数

需求范围：  单机

需求规格：  包含C驱动

功能概要：  directExecute支持绑定参数

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

directExecute支持绑定参数

  [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#3-interfaces%E6%8E%A5%E5%8F%A3)  

```

YacResult yacBindParameter(YacHandle hStmt, YacUint16 paramId, YacParamDirection direction, YacUint32 extType,
                           YacPointer value, YacInt32 size, YacInt32 bufLength, YacInt32* indicator)
  
YacResult yacDirectExecute(YacHandle hStmt, const YacChar* sql, YacInt32 sqlLength)



```

  [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

1、支持的api调用顺序：先bindparameter之后一次directexecute，之后不允许加execute; 

2、参数列表校验在客户端做：增加客户端解析能力（个数）；

3、directexecute之后清理参数列表；

4、按名绑定暂不支持；

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

  


```
YacResult yacBindParameter(YacHandle hStmt, YacUint16 paramId, YacParamDirection direction, YacUint32 extType,
                           YacPointer value, YacInt32 size, YacInt32 bufLength, YacInt32* indicator)
//新增未prepare时建立参数列表的逻辑
  if (stmt-&gt;params == NULL) {
        if (listCreateWithCb(yacAllocCb, yacFreeCb, &amp;stmt-&gt;conn-&gt;env-&gt;memCallbacks, sizeof(YacParam), &amp;stmt-&gt;params) !=
            COD_SUCCESS) {
            return YAC_ERROR;
        }
    }
    if (stmt-&gt;params-&gt;count &lt;= id) {
        YacParam* tempParam;
        for (CodUint32 i = stmt-&gt;params-&gt;count; i &lt;= id; i++) {
            if (listNew(stmt-&gt;params, (CodPointer*)&amp;tempParam) != COD_SUCCESS) {
                return YAC_ERROR;
            }
            memset(tempParam, 0, sizeof(YacParam));
        }
    }





YacResult yacParseParamCount(YacStatement* stmt, CodText* sqlText)
//新增客户端解析sql中参数数量的功能
{
    Lexer lexer;
    memset(&amp;lexer, 0, sizeof(Lexer));
    LangWord word;
    memset(&amp;word, 0, sizeof(LangWord));
    CodBool isEof = COD_FALSE;
    lexInit(&amp;lexer, sqlText, &amp;gYacTokenSet, ASCII, NULL);
    if (lexReadInMode(&amp;lexer, &amp;word, LREAD_MODE_COMBINED) != COD_SUCCESS) {
        return YAC_SUCCESS;
    }
    while (!isEof) {
        if (word.tokenId == YAC_TOKEN_EXPLAIN) {
            stmt-&gt;attr.paramCount = 0;
            break;
        }
        if (word.tokenId == YAC_TOKEN_CREATE || word.tokenId == YAC_TOKEN_ALTER || word.tokenId == YAC_TOKEN_BUILD) {
            break;
        }
        if (word.tokenId == YAC_TOKEN_BEGIN || word.tokenId == YAC_TOKEN_DECLARE) {
            break;
        }
        if (word.tokenId == YAC_TOKEN_STRING_AGG || word.tokenId == YAC_TOKEN_WM_CONCAT) {
            break;
        }
        if (word.tokenId == YAC_TOKEN_CM_ADDR) {
            break;
        }

        switch (word.type) {
            case LWORD_BRACKET:
                YAC_CALL(lexPushWord(&amp;lexer, &amp;word));
                if (lexReadInMode(&amp;lexer, &amp;word, LREAD_MODE_COMBINED) != COD_SUCCESS) {
                    return YAC_SUCCESS;
                }
                break;
            case LWORD_PARAM: {
                LangText* text = lexCurrText(&amp;lexer);
                if (text-&gt;value.str[0] != '=' || word.itext-&gt;value.str[0] != ':') {
                    stmt-&gt;attr.paramCount++;
                }
                if (lexReadInMode(&amp;lexer, &amp;word, LREAD_MODE_COMBINED) != COD_SUCCESS) {
                    return YAC_SUCCESS;
                }
                break;
            }
            case LWORD_EOF:
                if (lexer.stack.depth &gt; 0) {
                    lexPop(&amp;lexer);
                    if (lexReadInMode(&amp;lexer, &amp;word, LREAD_MODE_COMBINED) != COD_SUCCESS) {
                        return YAC_SUCCESS;
                    }
                } else if (lexer.stack.depth == 0 &amp;&amp; lexTryReadEof(&amp;lexer)) {
                    isEof = COD_TRUE;
                }
                break;
            default:
                if (lexReadInMode(&amp;lexer, &amp;word, LREAD_MODE_COMBINED) != COD_SUCCESS) {
                    return YAC_SUCCESS;
                }
        }
    }
    return YAC_SUCCESS;
}


YacResult yacDirectExecute(YacHandle hStmt, const YacChar* sql, YacInt32 sqlLength)
//新增函数处理绑定参数的情况

YAC_CALL(yacParseParamCount(stmt, &amp;sqlText));
    if (stmt-&gt;attr.paramCount &gt; 0) {
        stmt-&gt;attr.isFirstExecReq = YAC_TRUE;
        YAC_CALL(yacExecuteWithBindings(stmt, ackPacket, &amp;sqlText));
    } else {
        YAC_CALL(yacExecuteNoBinding(stmt, ackPacket, &amp;sqlText));
    }


```

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

```
TEST_F(TestYacDriverBase, testYacSingleRowBindDirectExecute)
{
YacHandle stmt = NULL;
YAC_EXPECT_CALL(yacAllocHandle(YAC_HANDLE_STMT, gTestEnv.conn, &amp;stmt));
YAC_EXPECT_CALL(yacDirectExecute(stmt, "drop table if exists test_yacli", YAC_NULL_TERM_STR));
YAC_EXPECT_CALL(yacDirectExecute(stmt, "create table test_yacli(col1 int, col2 varchar(200))", YAC_NULL_TERM_STR));

YacInt32 inputInt;
YacChar inputVarchar[200];
YacInt32 indicator;
YAC_EXPECT_CALL(yacBindParameter(stmt, 1, YAC_PARAM_INPUT, YAC_SQLT_INTEGER, &amp;inputInt, sizeof(YacInt32),
sizeof(YacInt32), NULL));
YAC_EXPECT_CALL(
yacBindParameter(stmt, 2, YAC_PARAM_INPUT, YAC_SQLT_VARCHAR2, (YacPointer)inputVarchar, 200, 200, &amp;indicator));

inputInt = 99;
memcpy(inputVarchar, "0123456789", 10);
indicator = 10;
YAC_EXPECT_CALL(yacDirectExecute(stmt, "insert into test_yacli values(?, ?)", YAC_NULL_TERM_STR));

YAC_EXPECT_CALL(yacBindParameter(stmt, 1, YAC_PARAM_INPUT, YAC_SQLT_INTEGER, &amp;inputInt, sizeof(YacInt32),
sizeof(YacInt32), NULL));
YAC_EXPECT_CALL(
yacBindParameter(stmt, 2, YAC_PARAM_INPUT, YAC_SQLT_VARCHAR2, (YacPointer)inputVarchar, 200, 200, &amp;indicator));

inputInt = 100;
memcpy(inputVarchar, "98765", 10);
indicator = 5;
YAC_EXPECT_CALL(yacDirectExecute(stmt, "insert into test_yacli values(?, ?)", YAC_NULL_TERM_STR));

YAC_EXPECT_CALL(yacCommit(gTestEnv.conn));

YAC_EXPECT_CALL(yacDirectExecute(stmt, "select * from test_yacli", YAC_NULL_TERM_STR));

YacInt32 outputInt;
YacChar outputVarchar[200];
YacInt32 outIndicator;
YAC_EXPECT_CALL(yacBindColumn(stmt, 0, YAC_SQLT_INTEGER, &amp;outputInt, sizeof(YacInt32), NULL));
YAC_EXPECT_CALL(yacBindColumn(stmt, 1, YAC_SQLT_VARCHAR2, outputVarchar, 200, &amp;outIndicator));

YacUint32 fetchedRows;
YAC_EXPECT_CALL(yacFetch(stmt, &amp;fetchedRows));
ASSERT_TRUE(fetchedRows == 1 &amp;&amp; outputInt == 99 &amp;&amp; memcmp(outputVarchar, "0123456789", outIndicator) == 0 &amp;&amp;
outIndicator == 10);
YAC_EXPECT_CALL(yacFetch(stmt, &amp;fetchedRows));
ASSERT_TRUE(fetchedRows == 1 &amp;&amp; outputInt == 100 &amp;&amp; memcmp(outputVarchar, "9876543210", outIndicator) == 0 &amp;&amp;
outIndicator == 5);
YAC_EXPECT_CALL(yacFreeHandle(YAC_HANDLE_STMT, stmt));
}




TEST_F(TestYacDriverBase, testYacBatchBindDirectExecute)
{
YacHandle stmt = NULL;
YAC_EXPECT_CALL(yacAllocHandle(YAC_HANDLE_STMT, gTestEnv.conn, &amp;stmt));
YAC_EXPECT_CALL(yacDirectExecute(stmt, "drop table if exists test_yacli", YAC_NULL_TERM_STR));
YAC_EXPECT_CALL(yacDirectExecute(stmt, "create table test_yacli(col1 int, col2 varchar(200))", YAC_NULL_TERM_STR));

YacInt32 inputInt[2];
YacChar inputVarchar[2][200];
YacInt32 indicator[2];
YAC_EXPECT_CALL(yacBindParameter(stmt, 1, YAC_PARAM_INPUT, YAC_SQLT_INTEGER, &amp;inputInt, sizeof(YacInt32),
sizeof(YacInt32), NULL));
YAC_EXPECT_CALL(
yacBindParameter(stmt, 2, YAC_PARAM_INPUT, YAC_SQLT_VARCHAR2, (YacPointer)inputVarchar, 200, 200, indicator));

inputInt[0] = 99;
memcpy(inputVarchar[0], "0123456789", 10);
indicator[0] = 10;

inputInt[1] = 100;
memcpy(inputVarchar[1], "98765", 10);
indicator[1] = 5;
YacUint32 paramSet = 2;
YAC_EXPECT_CALL(yacSetStmtAttr(stmt, YAC_ATTR_PARAMSET_SIZE, ¶mSet, sizeof(YacUint32)));
YAC_EXPECT_CALL(yacDirectExecute(stmt, "insert into test_yacli values(?, ?)", YAC_NULL_TERM_STR));
YAC_EXPECT_CALL(yacCommit(gTestEnv.conn));

YAC_EXPECT_CALL(yacDirectExecute(stmt, "select * from test_yacli", YAC_NULL_TERM_STR));

YacInt32 outputInt;
YacChar outputVarchar[200];
YacInt32 outIndicator;
YAC_EXPECT_CALL(yacBindColumn(stmt, 0, YAC_SQLT_INTEGER, &amp;outputInt, sizeof(YacInt32), NULL));
YAC_EXPECT_CALL(yacBindColumn(stmt, 1, YAC_SQLT_VARCHAR2, outputVarchar, 200, &amp;outIndicator));

YacUint32 fetchedRows;
YAC_EXPECT_CALL(yacFetch(stmt, &amp;fetchedRows));
ASSERT_TRUE(fetchedRows == 1 &amp;&amp; outputInt == 99 &amp;&amp; memcmp(outputVarchar, "0123456789", outIndicator) == 0 &amp;&amp;
outIndicator == 10);
YAC_EXPECT_CALL(yacFetch(stmt, &amp;fetchedRows));
ASSERT_TRUE(fetchedRows == 1 &amp;&amp; outputInt == 100 &amp;&amp; memcmp(outputVarchar, "9876543210", outIndicator) == 0 &amp;&amp;
outIndicator == 5);
YAC_EXPECT_CALL(yacFreeHandle(YAC_HANDLE_STMT, stmt));
}

```

##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

  
