Created by 郑思远, last modified on 七月 28, 2023

# 1.   **概述**

单机列表支持LOB API

# 2.   **需求分析**

  [YDBRD-12909](https://jira.yasdb.com/browse/YDBRD-12909?src=confmacro)    **-**  **单机列表支持LOB API**  **完成**

设计文档  **：**    [列表支持Lob API方案设计（单机） - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119548354)  

LOB API涉及jdbc、c驱动、python驱动

# 3.   **测试设计方法**

1.复用单机行存与lob相关的jdbc、c驱动、python驱动的用例，覆盖tac和lsc

2.根据列存lob特性进行质量加固

# 4.   **详细测试设计**

1.复用行存用例

1）jdbc

目录yasdb_jdbc_test/src/test/java/row/anchorlob

|  
|文件|备注|
|---|---|---|
|1|lobstream/BlobGetBinaryStreamTest.java|  
|
|2|lobstream/BlobStreamTest.java|  
|
|3|lobstream/ClobStreamTest.java|  
|
|4|BlobGetBinaryStreamTest.java|  
|
|5|BlobMethodTest.java|  
|
|6|ClobMethodTest.java|  
|
|7|LobSitCrossUse.java|  
|
|8|RawHeapJDBCTest.java|  
|
|9|SetClobReaderBigTest.java|  
|
|10|SetClobReaderTest.java|  
|
|11|blobBaseDataTest.java|  
|
|12|blobBigDataTest.java|  
|
|13|blobGetXxxTypeMapTest.java|  
|
|14|blobJdbcTest.java|  
|
|15|blobSetXxxTypeMapTest.java|  
|
|16|clobBaseDataTest.java|  
|
|17|clobBigData1Test.java|  
|
|18|clobBigData2Test.java|  
|
|19|clobGetXxxTypeMapTest.java|  
|
|20|clobJdbcTest.java|  
|
|21|clobSetXxxTypeMapTest.java|  
|
|22|getRawTypeTest.java|  
|
|23|xxxGetBlobTypeMapTest.java|  
|
|24|xxxGetClobTypeMapTest.java|  
|
|25|xxxSetBlobTypeMapTest.java|  
|
|26|xxxSetClobTypeMapTest.java|  
|


  


2）c驱动

yasdb-c-test/test_lob.h

  


3) python 驱动

yasdb_py_test/test_case/lob

|  
|文件|备注|
|---|---|---|
|1|test_sdv_python_blob_01.py|  
|
|2|test_sdv_python_blob_03.py|  
|
|3|test_sdv_python_blob_04.py|  
|
|4|test_sdv_python_blob_05.py|  
|
|5|test_sdv_python_blob_07.py|  
|
|6|test_sdv_python_blob_08.py|  
|
|7|test_sdv_python_blob_09.py|  
|
|8|test_sdv_python_clob_01.py|  
|
|9|test_sdv_python_clob_02.py|  
|
|10|test_sdv_python_clob_03.py|  
|
|11|test_sdv_python_clob_04.py|  
|
|12|test_sdv_python_clob_05.py|  
|
|13|test_sdv_python_clob_06.py|  
|
|14|test_sdv_python_clob_07.py|  
|
|15|test_sdv_python_clob_08.py|  
|
|16|test_sdv_python_clob_09.py|  
|
|17|test_sdv_python_clob_10.py|  
|
|18|test_sdv_python_clob_11.py|  
|


  


2.质量加固

1）lob回写测试

|  
|涉及接口|备注|
|---|---|---|
|1|blob.setBytes(long pos, byte[] bytes)|  
|
|2|blob.  setBytes(long pos, byte[] bytes, int offset, int len)|  
|
|3|blob.truncate(long len)|  
|
|4|blob.free()|  
|
|5|clob.  setString(long pos, String str)|  
|
|6|clob.  setString(long pos, String str, int offset, int len)|  
|
|7|clob.  truncate(long len)|  
|
|8|clob.  free()|  
|


a)回写场景

|场景维度一\场景维度二|对lob更新|结果集为多行，更新的长度超过单个lob的长度|inlinelob相互转化outlinelob|
|---|---|---|---|
|全部热数据|blob.setBytes(long pos, byte[] bytes),blob.setBytes(long pos, byte[] bytes, int offset, int len),blob.truncate(long len),clob.setString(long pos, String str),clob.setString(long pos, String str, int offset, int len),clob.truncate(long len)|blob.setBytes(long pos, byte[] bytes, int offset, int len),clob.setString(long pos, String str, int offset, int len)|blob.setBytes(long pos, byte[] bytes),clob.setString(long pos, String str)|
|热数据冷数据同时存在|blob.setBytes(long pos, byte[] bytes),blob.setBytes(long pos, byte[] bytes, int offset, int len),blob.truncate(long len),clob.setString(long pos, String str),clob.setString(long pos, String str, int offset, int len),clob.truncate(long len)|blob.setBytes(long pos, byte[] bytes, int offset, int len),clob.setString(long pos, String str, int offset, int len)|blob.setBytes(long pos, byte[] bytes),clob.setString(long pos, String str)|
|全部冷数据|blob.setBytes(long pos, byte[] bytes),blob.setBytes(long pos, byte[] bytes, int offset, int len),clob.setString(long pos, String str),clob.setString(long pos, String str, int offset, int len),clob.truncate(long len)|blob.setBytes(long pos, byte[] bytes, int offset, int len),clob.setString(long pos, String str, int offset, int len)|blob.setBytes(long pos, byte[] bytes),clob.setString(long pos, String str)|


  


b)不回写场景

|  
|场景|备注|
|---|---|---|
|1|resultset的lob经过计算得来|  
|
|2|未使用select for update|  
|


  


2）  locator测试

resultset 为多行，测试光标移动

|接口|备注|
|---|---|
|ResultSet.first()|  
|
|ResultSet.last()|  
|
|ResultSet.absolute( int row )|  
|
|ResultSet.relative( int rows )|  
|
|ResultSet.previous()|  
|


3）元数据

测试建表的lob类型的元数据是否可以查出来

|接口|备注|
|---|---|
|getFunctionColumns（）|  
|
|getColumns（）|  
|
|getProcedureColumns（）|  
|
|getVersionColumns（）|  
|


  


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

1. 单机 yasdb_jdbc


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

## Comments:

|  [](null)  ,1.调用存储过程出参入参为lob,2.关注资源有没有泄露,3.异常场景,4.分区表,Posted by zhengsiyuan at 七月 17, 2023 16:17|
|---|
