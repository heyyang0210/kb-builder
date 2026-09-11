Created by 冯皓博, last modified on 十一月 29, 2023

|类型|宏|说明|绑定|定义|
|---|---|---|---|---|
|OCIString|SQLT_VST|插入大小似乎无限制，调研测试最多插入32000000数据（不是上限）|value_sz：读取，为最大实际数据长度,小于32767会校验实际字符串长度要小于32767,大于等于32768不校验,alenp：,indp：,rcodep：|value_sz：,indp：,rlenp：,rcodep：|
|OCIRaw|SQLT_LVB|  
|  
|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|


OCIString：

|功能|目的|说明|
|---|---|---|
|  [OCIStringAllocSize()](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/oci-string-functions.html#GUID-3F336010-D8C8-4B50-89CB-ABCCA98905DA)  |获取字符串内存的分配大小（以字节为单位）|  
|
|  [OCIStringAssign()](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/oci-string-functions.html#GUID-58BC140A-900C-4409-B3D2-C2DC8FB643FF)  |将一个字符串赋值给一个字符串|  
|
|  [OCIStringAssignText()](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/oci-string-functions.html#GUID-96E8375B-9017-4E06-BF85-09C12DF286F4)  |将文本字符串分配给字符串|  
|
|  [OCIStringPtr()](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/oci-string-functions.html#GUID-0E1302F7-A32C-46F1-93D7-FB33CF60C24F)  |获取字符串指针|  
|
|  [OCIStringResize()](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/oci-string-functions.html#GUID-CA52A8A4-08BA-4F08-A4A3-79F841F6AE9E)  |调整字符串内存大小|初始化和释放接口,OCIStringResize 0 会将OCIString置为NULL,  
|
|  [OCIStringSize()](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/oci-string-functions.html#GUID-DBDAB2D9-4E78-4752-85B6-55D30CA6AF30)  |获取字符串大小|  
|


OCIRaw：

|功能|目的|说明|
|---|---|---|
|  [OCIRawAllocSize()](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/oci-raw-functions.html#GUID-4856A258-8883-4470-9881-51F27FA050F6)  |获取分配的原始内存大小（以字节为单位）|  
|
|  [OCIRawAssignBytes()](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/oci-raw-functions.html#GUID-3BB4239F-8579-4CC1-B76F-0786BDBAEF9A)  |将原始字节分配给原始|  
|
|  [OCIRawAssignRaw()](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/oci-raw-functions.html#GUID-27DBFBE0-4511-4B34-8476-B9AC720E3F51)  |将原始数据分配给原始数据|  
|
|  [OCIRawPtr()](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/oci-raw-functions.html#GUID-B05C44C5-7168-438B-AC2A-BD3AD309AAEA)  |获取原始数据指针|  
|
|  [OCIRawResize()](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/oci-raw-functions.html#GUID-7D757B00-DF25-4F61-A3DF-8C72F18FDC9E)  |调整可变长度原始内存的大小|  
|
|  [OCIRawSize()](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/oci-raw-functions.html#GUID-D74E75FA-5985-4DDC-BC25-430B415B8837)  |获取原始尺寸|  
|


YacString：

|功能|  
|  
|
|---|---|---|
|yacStringAlloc|  
|  
|
|yacStringAssign|  
|  
|
|yacStringAssignText|  
|  
|
|yacStringPtr|  
|  
|
|yacStringSize|  
|  
|
|yacStringFree|  
|  
|


YacRaw：

|功能|  
|  
|
|---|---|---|
|yacRawAlloc|  
|  
|
|yacRawAssign|  
|  
|
|yacRawAssignBytes|  
|  
|
|yacRawPtr|  
|  
|
|yacRawSize|  
|  
|
|yacRawFree|  
|  
|


  [OCIStringResize()](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/oci-string-functions.html#GUID-CA52A8A4-08BA-4F08-A4A3-79F841F6AE9E)    和    [OCIStringAllocSize()](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/oci-string-functions.html#GUID-3F336010-D8C8-4B50-89CB-ABCCA98905DA)    关系：

1、allocSize不会缩小，只会在resize中扩容

|resize|allocSize|
|---|---|
|1-36|36|
|37-44|44|
|45-52|52|
|  
|  
|
|  
|  
|
|  
|  
|


我们的格式：

resize+1同时向上8取整

调研用例：

create table test_lob(col1 blob, col2 clob);

```
static text* maxemp;

  maxemp = "truncate table test_lob";
  checkerr(errhp, OCIStmtPrepare(stmthp, errhp, maxemp,
      (ub4)strlen((char*)maxemp),
      (ub4)OCI_NTV_SYNTAX, (ub4)OCI_DEFAULT));

  checkerr(errhp, OCIStmtExecute(svchp, stmthp, errhp, (ub4)1, (ub4)0,
      (CONST OCISnapshot*) NULL, (OCISnapshot*)NULL, OCI_DEFAULT));

  maxemp = "insert into test_lob (col2) values (:1)";
  checkerr(errhp, OCIStmtPrepare(stmthp, errhp, maxemp,
      (ub4)strlen((char*)maxemp),
      (ub4)OCI_NTV_SYNTAX, (ub4)OCI_DEFAULT));

  OCIBind* bindp1 = NULL;
  OCIString* stringIn = NULL;

#define INSERT_STR_LEN 320000

  ub1* data_block = malloc(INSERT_STR_LEN);
  memset(data_block, 'a', INSERT_STR_LEN);
  ub4 data_block_len = INSERT_STR_LEN;

  checkerr(errhp, OCIStringAssignText(envhp, errhp, data_block, data_block_len, &stringIn));

  oratext* strPtr = OCIStringPtr(envhp, stringIn);
  ub4 strLenLen = strlen(strPtr);
  ub4 strLen = OCIStringSize(envhp, stringIn);

  ub4 allocSize;
  checkerr(errhp, OCIStringAllocSize(envhp, errhp, stringIn, &allocSize));

  checkerr(errhp, OCIBindByPos(stmthp, &bindp1, errhp, (ub4)1, (dvoid*)
      &stringIn, (sb4)32768, SQLT_VST, (dvoid*)NULL, (ub2*)NULL,
      (ub2*)0, 0, NULL, (ub4)OCI_DEFAULT));

  checkerr(errhp, OCIStmtExecute(svchp, stmthp, errhp, (ub4)1, (ub4)0,
    (CONST OCISnapshot*) NULL, (OCISnapshot*)NULL, OCI_COMMIT_ON_SUCCESS));

  OCIString* stringOut = NULL;

  checkerr(errhp, OCIStringResize(envhp, errhp, 32768, &stringOut));

  checkerr(errhp, OCIStringAllocSize(envhp, errhp, stringOut, &allocSize));

  maxemp = "select col2 from test_lob";
  checkerr(errhp, OCIStmtPrepare(stmthp, errhp, maxemp,
      (ub4)strlen((char*)maxemp),
      (ub4)OCI_NTV_SYNTAX, (ub4)OCI_DEFAULT));

  OCIDefine* definep = NULL;
  checkerr(errhp, OCIDefineByPos(stmthp, &definep, errhp, (ub4)1, (dvoid*)
      &stringOut, INSERT_STR_LEN, SQLT_VST, (dvoid*)NULL,
      NULL, NULL, (ub4)OCI_DEFAULT));

  checkerr(errhp, OCIStmtExecute(svchp, stmthp, errhp, (ub4)1, (ub4)0,
      (CONST OCISnapshot*) NULL, (OCISnapshot*)NULL, OCI_DEFAULT));

  strPtr = OCIStringPtr(envhp, stringOut);
  strLenLen = strlen(strPtr);
  strLen = OCIStringSize(envhp, stringOut);

  OCIString* stringOther = NULL;

  for (int i = 3500; i < 3600; i++) {
      checkerr(errhp, OCIStringResize(envhp, errhp, i, &stringOther));
      checkerr(errhp, OCIStringAllocSize(envhp, errhp, stringOther, &allocSize));

      printf("resize: %d, allocsize: %d\n", i, allocSize);
  }

  finish_demo(svchp, srvhp, authp, stmthp, stmthp1, inserthp);
  return OCI_SUCCESS;
```