Created by 方少奎, last modified on 十一月 11, 2024

  [https://pingcode.yasdb.com/pjm/items/6620d75dfd997db58adca300](https://pingcode.yasdb.com/pjm/items/6620d75dfd997db58adca300)    ?    
  #YDBRD-26491 【OCI】支持Trans相关接口

# 1. 总述

## 1.1 需求来源

支持oci事务和日期相关接口。

## 1.2 调研文档

Oracle官方文档（XA事务）：    [Developing Applications with Oracle XA](https://docs.oracle.com/en/database/oracle/oracle-database/21/adfns/xa.html#GUID-19B8285C-F8CA-4857-89E3-477C6BD1483C)  

Oracle官方文档（日期时间）：    [OCI Date, Datetime, and Interval Functions (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/18/lnoci/oci-date-datetime-and-interval-functions.html#GUID-7B403C69-F618-42A6-94F3-41FB17F7F0AD)  

oci参数绑定name调研文档：    [OCIBindByName](OCIBindByName_147765221.html)  

oci日期接口调研文档：    [OCIDate](OCIDate_150623983.html)  

oci事务接口调研文档：    [OCITrains](OCITrains_150623985.html)  

## 1.3 需求分析

- mysql源端查询表元数据，查询范围：


## 1.4 开源依赖

# 2. 接口

|接口|
|---|
|sword OCITransCommit ( OCISvcCtx *svchp,OCIError *errhp,ub4 flags );|
|sword OCITransRollback ( void *svchp,OCIError *errhp,ub4 flags );|
|sword OCITransStart  ( OCISvcCtx *svchp,   OCIError *errhp,    uword timeout,   ub4 flags );|
|sword OCITransDetach(OCISvcCtx *svchp,OCIError *errhp,ub4 flags );|
|sword OCITransPrepare(OCISvcCtx *svchp,OCIError *errhp,ub4 flags );|
|sword OCITransForget(OCISvcCtx *svchp,OCIError *errhp,ub4 flags );|
|sword OCIDateSys  Date  (OCIError *err, OCIDate *sys_date);|
|sword OCIDateToText  (OCIError *err, const OCIDate *date,const oratext *fmt, ,ub1 fmt_length,const oratext *lang_name, ub4 lang_length,ub4 *buf_size, oratext *buf)|
|sword OCIDateFromText  (OCIError *err, const oratext *date_str,ub4 d_str_length, ,const oratext *fmt, ub1 fmt_length,const oratext *lang_name, ub4 lang_length,OCIDate *date);|
|sword OCIDateTimeSysTimeStamp  (void *hndl, OCIError *err, OCIDateTime *sys_date);|
|sword OCIDateTimeToText  (void *hndl, OCIError *err, const OCIDateTime *date,     
  const OraText *fmt, ub1 fmt_length, ub1 fsprec,     
  const OraText *lang_name, size_t lang_length,     
  ub4 *buf_size, OraText *buf );|
|sword OCIDateTimeFromText  (void *hndl, OCIError *err, const OraText *date_str,     
  size_t dstr_length, const OraText *fmt, ub1 fmt_length,    
  const OraText *lang_name, size_t lang_length, OCIDateTime *date );|
|sword OCIDateTimeGetTimeZoneOffset  (void *hndl,OCIError *err,    
  const OCIDateTime *datetime,    
  sb1 *hr,sb1 *mm);|
|sword OCIDateTimeAssign  (void *hndl, OCIError *err, const OCIDateTime *from,     
  OCIDateTime *to);|
|sword OCIDateTimeCheck  (void *hndl, OCIError *err, const OCIDateTime *date,     
  ub4 *valid );|
|sword OCIDateTimeCompare  (void *hndl, OCIError *err, const OCIDateTime *date1,     
  const OCIDateTime *date2, sword *result );|
|sword OCIDateTimeConvert  (void *hndl, OCIError *err, OCIDateTime *indate,    
  OCIDateTime *outdate);|
|sword OCIBindByName  (OCIStmt *stmtp, OCIBind **bindp, OCIError *errhp,,const OraText *placeholder, sb4 placeh_len,void *valuep, sb4 value_sz, ub2 dty,,void *indp, ub2 *alenp, ub2 *rcodep,ub4 maxarr_len, ub4 *curelep, ub4 mode);|


# 3. 规格约束

  


# 4. 特性

  


# 5. 自测用例

|功能|代码|
|---|---|
|BindByName|```
typedef struct BindIntByNameCtx {
    ub4* intIn;
    int i;
    sb2 ind;
} BindIntByNameCtx;

static sb4 bindIntByNameCb(dvoid* ctxp, OCIBind* bindp, ub4 iter, ub4 index, dvoid** bufpp, ub4* alenp, ub1* piecep, dvoid** indpp)
{
    BindIntByNameCtx* context = (BindIntByNameCtx*)ctxp;
    *bufpp = &context->intIn[iter];
    *alenp = context->i;
    *indpp = &context->ind;
    *piecep = OCI_ONE_PIECE;
    return OCI_CONTINUE;
}

sword testBindIntByName()
{
    OCIStmt* stmthp = NULL;
    (void)OCIHandleAlloc((dvoid*)envhp, (dvoid**)&stmthp, OCI_HTYPE_STMT, (size_t)0, (dvoid**)0);

    OCIBind*   bindp = NULL;
    OCIDefine* definep = NULL;

    OraText* sql = (unsigned char*) "drop table if exists testBindByName";
    OCI_TEST_CALL(OCIStmtPrepare(stmthp, errhp, sql, (ub4)strlen((char*)sql), (ub4)OCI_NTV_SYNTAX, (ub4)OCI_DEFAULT));
    OCI_TEST_CALL(OCIStmtExecute(svchp, stmthp, errhp, (ub4)1, (ub4)0, NULL, NULL, OCI_DEFAULT));

    sql = (unsigned char*) "create table testBindByName(col1 int, col2 int, col3 int, str1 varchar(10), str2 varchar(10))";
    OCI_TEST_CALL(OCIStmtPrepare(stmthp, errhp, sql, (ub4)strlen((char*)sql), (ub4)OCI_NTV_SYNTAX, (ub4)OCI_DEFAULT));
    OCI_TEST_CALL(OCIStmtExecute(svchp, stmthp, errhp, (ub4)1, (ub4)0, NULL, NULL, OCI_DEFAULT));

    sql = (unsigned char*) "insert into testBindByName values (?, :col1, :col1, :str, :str)";
    OCI_TEST_CALL(OCIStmtPrepare(stmthp, errhp, sql, (ub4)strlen((char*)sql), (ub4)OCI_NTV_SYNTAX, (ub4)OCI_DEFAULT));
    ub4 intIn[3] = {0, 1, 2};
    OCI_TEST_CALL(OCIBindByPos(stmthp, &bindp, errhp, (ub4) 1, (dvoid*)intIn, (sb4)sizeof(ub4), SQLT_INT, 0, 0, 0, 0, NULL, OCI_DEFAULT));
    ub4 intIn0[3] = {5, 4, 5};
    BindIntByNameCtx context = {.intIn = intIn0, .ind = 0, .i = 4};
    OCI_TEST_CALL(OCIBindByName(stmthp, &bindp, errhp, (unsigned char*) ":col1", 5, (dvoid*)intIn, (sb4)sizeof(ub4), SQLT_INT, 0, 0, 0, 0, NULL, OCI_DATA_AT_EXEC));
    OCI_TEST_CALL(OCIBindDynamic(bindp, errhp, &context, bindIntByNameCb, NULL, NULL));
    oratext strIn[3][8] = {"aaa", "bbb", "ccc"};
    sb2     ind1[3] = {0, 0, 0};
    ub2     rlen1[3] = {-1, -1, -1};
    OCI_TEST_CALL(OCIBindByName(stmthp, &bindp, errhp, (unsigned char*) ":str", 4, (dvoid*)strIn, (sb4)8, SQLT_STR, ind1, rlen1, 0, 0, NULL, OCI_DEFAULT));
    OCI_TEST_CALL(OCIStmtExecute(svchp, stmthp, errhp, (ub4)3, (ub4)0, NULL, NULL, OCI_DEFAULT));

    ub4 intOut1[3] = {0};
    ub4 intOut2[3] = {0};
    ub4 intOut3[3] = {0};
    oratext strOut1[3][8] = {0};
    oratext strOut2[3][8] = {0};
    sql = (unsigned char*) "select * from testBindByName";
    OCI_TEST_CALL(OCIStmtPrepare(stmthp, errhp, sql, (ub4)strlen((char*)sql), (ub4)OCI_NTV_SYNTAX, (ub4)OCI_DEFAULT));
    OCI_TEST_CALL(OCIDefineByPos(stmthp, &definep, errhp, (ub4)1, (dvoid*)intOut1, (sb4)sizeof(ub4), SQLT_INT, 0, 0, 0, OCI_DEFAULT));
    OCI_TEST_CALL(OCIDefineByPos(stmthp, &definep, errhp, (ub4)2, (dvoid*)intOut2, (sb4)sizeof(ub4), SQLT_INT, 0, 0, 0, OCI_DEFAULT));
    OCI_TEST_CALL(OCIDefineByPos(stmthp, &definep, errhp, (ub4)3, (dvoid*)intOut3, (sb4)sizeof(ub4), SQLT_INT, 0, 0, 0, OCI_DEFAULT));
    OCI_TEST_CALL(OCIDefineByPos(stmthp, &definep, errhp, (ub4)4, (dvoid*)strOut1, (sb4)8, SQLT_STR, ind1, rlen1, 0, OCI_DEFAULT));
    OCI_TEST_CALL(OCIDefineByPos(stmthp, &definep, errhp, (ub4)5, (dvoid*)strOut2, (sb4)8, SQLT_STR, ind1, rlen1, 0, OCI_DEFAULT));
    OCI_TEST_CALL(OCIStmtExecute(svchp, stmthp, errhp, (ub4)3, (ub4)0, NULL, NULL, OCI_DEFAULT));

    (void)OCIHandleFree((dvoid*)stmthp, (ub4)OCI_HTYPE_STMT);

    if (intOut1[0] == 0 && intOut1[1] == 1 && intOut1[2] == 2
        && intOut2[0] == 5 && intOut2[1] == 4 && intOut2[2] == 5
        && intOut3[0] == 5 && intOut3[1] == 4 && intOut3[2] == 5
        && memcmp(strOut1[0], "aaa", 3) == 0 && memcmp(strOut1[1], "bbb", 3) == 0 && memcmp(strOut1[2], "ccc", 3) == 0
        && memcmp(strOut2[0], "aaa", 3) == 0 && memcmp(strOut2[1], "bbb", 3) == 0 && memcmp(strOut2[2], "ccc", 3) == 0) {
        return OCI_SUCCESS;
    }
    return OCI_ERROR;
}
```|
|Trans接口|```
sword testOCITrans() {
    OCIStmt*    stmthp1, *stmthp2;
    OCITrans*   txnhp1, *txnhp2;
    XID         gxid;
    text        sqlstmt[128];
    OCIServerAttach( srvhp, errhp, (text *) 0, (sb4) 0, (ub4) OCI_DEFAULT);
    OCIHandleAlloc((void  *)envhp, (void  **)&stmthp1, OCI_HTYPE_STMT, 0, 0);
    OCIHandleAlloc((void  *)envhp, (void  **)&stmthp2, OCI_HTYPE_STMT, 0, 0);
    OCIAttrSet((void  *)svchp, OCI_HTYPE_SVCCTX, (void  *)srvhp, 0, OCI_ATTR_SERVER, errhp);

    sprintf((char *)sqlstmt, "DROP TABLE IF EXISTS EMPLOYEES");
    OCI_TEST_CALL(OCIStmtPrepare(stmthp1, errhp, sqlstmt, (ub4) strlen((char *)sqlstmt), OCI_NTV_SYNTAX, 0));
    OCI_TEST_CALL(OCIStmtExecute(svchp, stmthp1, errhp, 1, 0, 0, 0, 0));
    sprintf((char *)sqlstmt, "CREATE TABLE EMPLOYEES (EMPLOYEE_ID int, SALARY int)");
    OCI_TEST_CALL(OCIStmtPrepare(stmthp1, errhp, sqlstmt, (ub4) strlen((char *)sqlstmt), OCI_NTV_SYNTAX, 0));
    OCI_TEST_CALL(OCIStmtExecute(svchp, stmthp1, errhp, 1, 0, 0, 0, 0));
    sprintf((char *)sqlstmt, "INSERT INTO EMPLOYEES VALUES(7902, 100),(7934, 200)");
    OCI_TEST_CALL(OCIStmtPrepare(stmthp1, errhp, sqlstmt, (ub4) strlen((char *)sqlstmt), OCI_NTV_SYNTAX, 0));
    OCI_TEST_CALL(OCIStmtExecute(svchp, stmthp1, errhp, 1, 0, 0, 0, 0));
    OCI_TEST_CALL(OCITransCommit(svchp, errhp, (ub4) 0));

    /* allocate transaction handle 1 and set it in the service handle */
    OCIHandleAlloc((void  *)envhp, (void  **)&txnhp1,  OCI_HTYPE_TRANS, 0, 0);
    OCIAttrSet((void  *)svchp, OCI_HTYPE_SVCCTX, (void  *)txnhp1, 0, OCI_ATTR_TRANS, errhp);

    /* start a transaction with global transaction id = [1000, 123, 1] */
    gxid.formatID = 1000; /* format id = 1000 */
    gxid.gtrid_length = 3; /* gtrid = 123 */
    gxid.data[0] = '1'; gxid.data[1] = '1'; gxid.data[2] = '1';
    gxid.bqual_length = 2; /* bqual = 1 */
    gxid.data[3] = '2';gxid.data[4] = '2';

    OCIAttrSet((void  *)txnhp1, OCI_HTYPE_TRANS, (void  *)&gxid, sizeof(XID), OCI_ATTR_XID, errhp);

    /* start global transaction 1 with 60-second time to live when detached */
    OCI_TEST_CALL(OCITransStart(svchp, errhp, 60, TMNOFLAGS));

    /* update hr.employees employee_id=7902, increment salary */
    sprintf((char *)sqlstmt, "UPDATE EMPLOYEES SET SALARY = SALARY + 1 WHERE EMPLOYEE_ID = 7902");
    OCIStmtPrepare(stmthp1, errhp, sqlstmt, (ub4) strlen((char *)sqlstmt), OCI_NTV_SYNTAX, 0);
    OCIStmtExecute(svchp, stmthp1, errhp, 1, 0, 0, 0, 0);

    /* detach the transaction */
    OCI_TEST_CALL(OCITransDetach(svchp, errhp, 0));

    /* allocate transaction handle 2 and set it in the service handle */
    OCIHandleAlloc((void  *)envhp, (void  **)&txnhp2,  OCI_HTYPE_TRANS, 0, 0);

    OCIAttrSet((void  *)svchp, OCI_HTYPE_SVCCTX, (void  *)txnhp2, 0, OCI_ATTR_TRANS, errhp);

    /* start a transaction with global transaction id = [1000, 124, 1] */
    gxid.formatID = 1000; /* format id = 1000 */
    gxid.gtrid_length = 3; /* gtrid = aaa */
    gxid.data[0] = 'a'; gxid.data[1] = 'a'; gxid.data[2] = 'a';
    gxid.bqual_length = 2; /* bqual = bb */
    gxid.data[3] = 'b';gxid.data[4] = 'b';

    OCIAttrSet((void  *)txnhp2, OCI_HTYPE_TRANS, (void  *)&gxid, sizeof(XID), OCI_ATTR_XID, errhp);

    /* start global transaction 2 with 90 second time to live when detached */
    OCI_TEST_CALL(OCITransStart(svchp, errhp, 90, TMNOFLAGS));

    /* update hr.employees employee_id=7934, increment salary */
    sprintf((char *)sqlstmt, "UPDATE EMPLOYEES SET SALARY = SALARY + 1 WHERE EMPLOYEE_ID = 7934");
    OCIStmtPrepare(stmthp2, errhp, sqlstmt, (ub4) strlen((char *)sqlstmt), OCI_NTV_SYNTAX, 0);
    OCIStmtExecute(svchp, stmthp2, errhp, 1, 0, 0, 0, 0);

    /* detach the transaction */
    OCI_TEST_CALL(OCITransDetach(svchp, errhp, 0));

    /* Resume transaction 1, increment salary and commit it */
    /* Set transaction handle 1 into the service handle */
    OCIAttrSet((void *)svchp, OCI_HTYPE_SVCCTX, (void  *)txnhp1, 0, OCI_ATTR_TRANS, errhp);

    /* attach to transaction 1, wait for 10 seconds if the transaction is busy */
    /* The wait is clearly not required in this example because no other */
    /* process/thread is using the transaction. It is only for illustration */
    OCI_TEST_CALL(OCITransStart(svchp, errhp, 10, TMRESUME));
    OCIStmtExecute(svchp, stmthp1, errhp, 1, 0, 0, 0, 0);

    OCI_TEST_CALL(OCITransPrepare(svchp, errhp, TMNOFLAGS));
    OCI_TEST_CALL(OCITransCommit(svchp, errhp, TMNOFLAGS));

    /* attach to transaction 2 and commit it */
    /* set transaction handle2 into the service handle */
    OCIAttrSet((void  *)svchp, OCI_HTYPE_SVCCTX, (void  *)txnhp2, 0, OCI_ATTR_TRANS, errhp);
    OCI_TEST_CALL(OCITransPrepare(svchp, errhp, TMNOFLAGS));
    OCI_TEST_CALL(OCITransCommit(svchp, errhp, TMNOFLAGS));

    OCIHandleFree(stmthp1, OCI_HTYPE_STMT);
    OCIHandleFree(stmthp2, OCI_HTYPE_STMT);
    OCIHandleFree(txnhp1, OCI_HTYPE_TRANS);
    OCIHandleFree(txnhp2, OCI_HTYPE_TRANS);
    return OCI_SUCCESS;
}
```|
|Date接口|```
sword testOCIDate() {
    OCIDate sysDate;
    OCI_TEST_CALL(OCIDateSysDate(errhp, &sysDate));
    oratext buf[64];
    ub4 bufSize = 64;
    OCI_TEST_CALL(OCIDateToText(errhp, &sysDate, (oratext*)"DD-MM-YYYY", 10, (oratext*)"EN", 2, &bufSize, buf));
    OCIDate textDate;
    OCI_TEST_CALL(OCIDateFromText(errhp, buf, bufSize, (oratext*)"DD-MM-YYYY", 10, (oratext*)"EN", 2, &textDate));
    if(sysDate.OCIDateYYYY != textDate.OCIDateYYYY || sysDate.OCIDateMM != textDate.OCIDateMM || sysDate.OCIDateDD != textDate.OCIDateDD
        || 0 != textDate.OCIDateTime.OCITimeHH
        || 0 != textDate.OCIDateTime.OCITimeMI
        || 0 != textDate.OCIDateTime.OCITimeSS ) {
        return OCI_ERROR;
    }
    return OCI_SUCCESS;
}

sword testOCIDateTime() {
    OCIDateTime* sysDate;
    OCIDescriptorAlloc(envhp, (void**) &sysDate, OCI_DTYPE_TIMESTAMP, 0, 0);
    OCI_TEST_CALL(OCIDateTimeSysTimeStamp(envhp, errhp, sysDate));

    OraText fmt[25] = "MM-DD-YYYY HH24:MI:SS.FF";
    ub1     fmt_len = 24;
    OraText lang[3] = "EN";
    OraText buf[32], buf1[32];
    ub4 bufSize = 32;
    OCI_TEST_CALL(OCIDateTimeToText(envhp, errhp, sysDate, fmt, fmt_len, 0, lang, 2, &bufSize, buf));

    OCIDateTime* textDate;
    OCIDescriptorAlloc(envhp, (void**) &textDate, OCI_DTYPE_TIMESTAMP, 0, 0);
    OCI_TEST_CALL(OCIDateTimeFromText(envhp, errhp, buf, bufSize, fmt, fmt_len, lang, 2, textDate));
    bufSize = 32;
    OCI_TEST_CALL(OCIDateTimeToText(envhp, errhp, textDate, fmt, fmt_len, 0, lang, 2, &bufSize, buf1));
    if (memcmp(buf, buf1, bufSize) != 0) {
        return OCI_ERROR;
    }

    sword result;
    OCI_TEST_CALL(OCIDateTimeCompare(envhp, errhp, sysDate, textDate, &result));
    if (result != 0) {
        return OCI_ERROR;
    }

    OCIDateTime* textDate1;
    OCIDateTime* textDate2;
    OCIDescriptorAlloc(envhp, (void**) &textDate1, OCI_DTYPE_TIMESTAMP, 0, 0);
    OCIDescriptorAlloc(envhp, (void**) &textDate2, OCI_DTYPE_TIMESTAMP, 0, 0);
    OCI_TEST_CALL(OCIDateTimeFromText(envhp, errhp, (const OraText*)"09-20-2024 09:55:06.376085", 26, fmt, fmt_len, lang, 2, textDate1));
    OCI_TEST_CALL(OCIDateTimeFromText(envhp, errhp, (const OraText*)"09-20-2024 10:55:06.376085", 26, fmt, fmt_len, lang, 2, textDate2));
    OCI_TEST_CALL(OCIDateTimeCompare(envhp, errhp, textDate1, textDate2, &result));
    if (result != -1) {
        return OCI_ERROR;
    }
    OCI_TEST_CALL(OCIDateTimeFromText(envhp, errhp, (const OraText*)"09-20-2024 10:55:06.376085", 26, fmt, fmt_len, lang, 2, textDate1));
    OCI_TEST_CALL(OCIDateTimeFromText(envhp, errhp, (const OraText*)"09-20-2024 09:55:06.376085", 26, fmt, fmt_len, lang, 2, textDate2));
    OCI_TEST_CALL(OCIDateTimeCompare(envhp, errhp, textDate1, textDate2, &result));
    if (result != 1) {
        return OCI_ERROR;
    }
    OCI_TEST_CALL(OCIDateTimeFromText(envhp, errhp, (const OraText*)"09-20-2024 10:00:06.000000", 26, fmt, fmt_len, lang, 2, textDate1));
    OCI_TEST_CALL(OCIDateTimeFromText(envhp, errhp, (const OraText*)"09-20-2024 10:00:06.376085", 26, fmt, fmt_len, lang, 2, textDate2));
    OCI_TEST_CALL(OCIDateTimeCompare(envhp, errhp, textDate1, textDate2, &result));
    if (result != -1) {
        return OCI_ERROR;
    }
    OCI_TEST_CALL(OCIDateTimeFromText(envhp, errhp, (const OraText*)"09-20-2024 10:00:06.376085", 26, fmt, fmt_len, lang, 2, textDate1));
    OCI_TEST_CALL(OCIDateTimeFromText(envhp, errhp, (const OraText*)"09-20-2024 10:00:06.000000", 26, fmt, fmt_len, lang, 2, textDate2));
    OCI_TEST_CALL(OCIDateTimeCompare(envhp, errhp, textDate1, textDate2, &result));
    if (result != 1) {
        return OCI_ERROR;
    }
    OCI_TEST_CALL(OCIDateTimeAssign(envhp, errhp, textDate1, textDate2));
    OCI_TEST_CALL(OCIDateTimeCompare(envhp, errhp, textDate1, textDate2, &result));
    if (result != 0) {
        return OCI_ERROR;
    }
    OCI_TEST_CALL(OCIDateTimeConvert(envhp, errhp, textDate1, textDate2));

    sb1 hr, mm, hr1, mm1;
    OCI_TEST_CALL(OCIDateTimeGetTimeZoneOffset(envhp, errhp, sysDate, &hr, &mm));
    OCI_TEST_CALL(OCIDateTimeGetTimeZoneOffset(envhp, errhp, textDate1, &hr1, &mm1));
    if (hr != hr1 || mm != mm1) {
        return OCI_ERROR;
    }

    ub4 valid = 0;
    OCI_TEST_CALL(OCIDateTimeCheck(envhp, errhp, textDate1, &valid));
    if (valid != 0) {
        return OCI_ERROR;
    }

    OCIDescriptorFree(sysDate, OCI_DTYPE_TIMESTAMP);
    OCIDescriptorFree(textDate, OCI_DTYPE_TIMESTAMP);
    OCIDescriptorFree(textDate1, OCI_DTYPE_TIMESTAMP);
    OCIDescriptorFree(textDate2, OCI_DTYPE_TIMESTAMP);
    return OCI_SUCCESS;
}
```|


  


# 6. 资料设计章节

# 7. 未来规划