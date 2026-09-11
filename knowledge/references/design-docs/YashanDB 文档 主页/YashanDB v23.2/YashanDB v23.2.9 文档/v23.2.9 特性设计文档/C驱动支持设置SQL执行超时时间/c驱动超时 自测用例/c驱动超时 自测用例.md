Created by 程康 on 十月 31, 2024

```
TEST_F(TestYacDriverBase, testExecTimeout1)
{
    YacHandle yacEnv = NULL;
    YacHandle yac_con;
    YacHandle hStmt;
    YacUint32 rows;
    YacInt16  urlLen = (YacInt16)strlen(gSrvStr);
    YacInt16  userLen = (YacInt16)strlen(user);
    YacInt16  pwdLen = (YacInt16)strlen(pwd);
    
    YAC_EXPECT_CALL(yacAllocHandle(YAC_HANDLE_ENV, NULL, &yacEnv));
    YAC_EXPECT_CALL(yacAllocHandle(YAC_HANDLE_DBC, yacEnv, &yac_con));
    YAC_EXPECT_CALL(yacConnect(yac_con, gSrvStr, urlLen, user, userLen, pwd, pwdLen));
    YAC_EXPECT_CALL(yacAllocHandle(YAC_HANDLE_STMT, yac_con, &hStmt));
    CodUint64      timeoutGet;
    YAC_EXPECT_CALL(yacGetStmtAttr(hStmt, YAC_ATTR_TIMEOUT, &timeoutGet, sizeof(CodUint64), NULL));
    ASSERT_EQ(timeoutGet, 0);
    
    const YacChar* sql1 = "DROP TABLE IF EXISTS test1";
    const YacChar* sql2 = "CREATE TABLE test1(c1 int, c2 char(2048))";
    const YacChar* sql3 = "INSERT INTO test1 VALUES(1, 'test1 row1')";
    const YacChar* sql4 = "commit";
    const YacChar* sql5 = "select count(*) from test1";
    YacInt32       sqlLen1 = (YacInt32)strlen(sql1);
    YacInt32       sqlLen2 = (YacInt32)strlen(sql2);
    YacInt32       sqlLen3 = (YacInt32)strlen(sql3);
    YacInt32       sqlLen4 = (YacInt32)strlen(sql4);
    YacInt32       sqlLen5 = (YacInt32)strlen(sql5);
    YAC_EXPECT_CALL(yacDirectExecute(hStmt, sql1, sqlLen1));
    YAC_EXPECT_CALL(yacDirectExecute(hStmt, sql2, sqlLen2));
    CodUint64      timeout = 2;
    YAC_EXPECT_CALL(yacSetStmtAttr(hStmt, YAC_ATTR_TIMEOUT, &timeout, sizeof(CodUint64)));
    YAC_EXPECT_CALL(yacDirectExecute(hStmt, sql3, sqlLen3));
    
    YAC_EXPECT_CALL(yacPrepare(hStmt, sql3, sqlLen3));
    YAC_EXPECT_CALL(yacExecute(hStmt));
    
    timeout = 200;
    YAC_EXPECT_CALL(yacSetStmtAttr(hStmt, YAC_ATTR_TIMEOUT, &timeout, sizeof(CodUint64)));
    YAC_EXPECT_CALL(yacExecute(hStmt));
    
    YAC_EXPECT_CALL(yacDirectExecute(hStmt, sql4, sqlLen4));
    YAC_EXPECT_CALL(yacDirectExecute(hStmt, sql5, sqlLen5));

    YacInt32       intout;
    YAC_EXPECT_CALL(yacBindColumn(hStmt, 0, YAC_TYPE_INTEGER, &intout, sizeof(YacInt32), NULL));
    YAC_EXPECT_CALL(yacFetch(hStmt, &rows));

    const YacChar* sql = "SELECT 1 FROM DUAL";
    YacInt32       sqlLen = (YacInt32)strlen(sql);
    timeout = 20;
    YAC_EXPECT_CALL(yacSetStmtAttr(hStmt, YAC_ATTR_TIMEOUT, &timeout, sizeof(CodUint64)));
    YAC_EXPECT_CALL(yacDirectExecute(hStmt, sql, sqlLen));
    YAC_EXPECT_CALL(yacGetStmtAttr(hStmt, YAC_ATTR_TIMEOUT, &timeoutGet, sizeof(CodUint64), NULL));
    ASSERT_EQ(timeoutGet, 20);
    
    YAC_EXPECT_CALL(yacPrepare(hStmt, sql, sqlLen));
    YAC_EXPECT_CALL(yacExecute(hStmt));
    
    timeout = 0;
    YAC_EXPECT_CALL(yacSetStmtAttr(hStmt, YAC_ATTR_TIMEOUT, &timeout, sizeof(CodUint64)));
    YAC_EXPECT_CALL(yacExecute(hStmt));

    timeout = -5;
    YAC_EXPECT_ERROR_CALL(yacSetStmtAttr(hStmt, YAC_ATTR_TIMEOUT, &timeout, sizeof(CodUint64)));
    YAC_EXPECT_CALL(yacFetch(hStmt, &rows));
    YAC_EXPECT_CALL(yacGetStmtAttr(hStmt, YAC_ATTR_TIMEOUT, &timeoutGet, sizeof(CodUint64), NULL));

    ASSERT_EQ(timeoutGet, 0);

    const YacChar* sql6 =
        "BEGIN\n"
        "    DBMS_RANDOM.SEED(12345);\n"
        "END;";
    YacInt32 sqlLen6 = (YacInt32)strlen(sql6);
    timeout = 20;
    YAC_EXPECT_CALL(yacSetStmtAttr(hStmt, YAC_ATTR_TIMEOUT, &timeout, sizeof(CodUint64)));

    YAC_EXPECT_CALL(yacPrepare(hStmt, sql6, sqlLen6));
    YAC_EXPECT_CALL(yacExecute(hStmt));
    
    timeout = 0;
    YAC_EXPECT_CALL(yacSetStmtAttr(hStmt, YAC_ATTR_TIMEOUT, &timeout, sizeof(CodUint64)));
    YAC_EXPECT_CALL(yacExecute(hStmt));
    
    YAC_EXPECT_CALL(yacFreeHandle(YAC_HANDLE_STMT, hStmt));
    YAC_EXPECT_CALL(yacFreeHandle(YAC_HANDLE_DBC, yac_con));
    YAC_EXPECT_CALL(yacFreeHandle(YAC_HANDLE_ENV, yacEnv));
}

TEST_F(TestYacDriverBase, testExecTimeout2)
{
    YacHandle yacEnv = NULL;
    YacHandle yac_con;
    YacUint32 rows;
    YacInt16  urlLen = (YacInt16)strlen(gSrvStr);
    YacInt16  userLen = (YacInt16)strlen(user);
    YacInt16  pwdLen = (YacInt16)strlen(pwd);
    
    YAC_EXPECT_CALL(yacAllocHandle(YAC_HANDLE_ENV, NULL, &yacEnv));
    YAC_EXPECT_CALL(yacAllocHandle(YAC_HANDLE_DBC, yacEnv, &yac_con));
    YAC_EXPECT_CALL(yacConnect(yac_con, gSrvStr, urlLen, user, userLen, pwd, pwdLen));
    
    const YacChar* sql = "select * from obj$";
    YacInt32       sqlLen = (YacInt32)strlen(sql);
    YacHandle hStmt[10240];
    for (CodUint64 i = 0; i < 10240; i++) {
        if (yacAllocHandle(YAC_HANDLE_STMT, yac_con, &hStmt[i]) == YAC_SUCCESS) {
            yacDirectExecute(hStmt[i], sql, sqlLen);
            yacFetch(hStmt[i], &rows);
        }
    }
    for (CodUint64
```

  
