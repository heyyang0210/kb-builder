Created by 李潮, last modified on 七月 05, 2024

# 1.总述

分布式行表支持lob基本功能

  [https://pingcode.yasdb.com/pjm/items/66169303fd997db58ad70aef](https://pingcode.yasdb.com/pjm/items/66169303fd997db58ad70aef)    ?    
  #YDBRD-26067 【分布式】支持分布式行存CLOB/JSON

开发文档：    [分布式支持行LOB、JSON现状设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156110407)  

  


# 2.概述

1.除不支持outline lob跨节点参与计算外，其余和单机保持一致，范围包含：

|支持项|说明|
|---|---|
|JSON处理函数|JSON，JSON_ARRAY_GET，JSON_ARRAY_LENGTH，JSON_EXISTS，JSON_FORMAT，JSON_PARSE，JSON_QUERY，JSON_SERIALIZE，......|
|LOB API|  [分布式支持LOB更新删除以及API：详细设计](https://conf.yasdb.com/pages/viewpage.action?pageId=119542667)  |
|基本SQL语法|1. 建表支持lob类型，支持指定行内以及行外存储。disable/enable storage in row
1. insert
1. update
1. select
|
|高级包|23.3暂不支持|


2.约束：

1.不支持跨节点  outline     lob计算

2.暂不支持高级包，包括sys用户

3.nclob支持

  


3.交付范围：

1.交付版本：23.3

2.交付形态：分布式

# 3.测试设计

## 1.基本sql语法

**复用分布式列表用例+修改单机行表用例:**

**目录：/datatype_01/blob/lsc，/datatype/clob/lsc**

**blob: 192个用例文件**

FEATURE_PATH = '/datatype_01/blob/lsc' and DEPLOY_MODE =2 and TABLE_TYPE =2 and VERSION ='dev' and "HIERARCHY" =2

**clob:238个用例文件**

FEATURE_PATH = '/datatype/clob/lsc' and DEPLOY_MODE =2 and TABLE_TYPE =2 and VERSION ='dev' and "HIERARCHY" =2

  


YashanDB对大对象类型的存储包含行内存储和行外存储两种方式：

- **当一行的LOB列的数据小于一定的字节限制时，LOB数据将存储在行内。对于HEAP表，该限制是4000字节；对于TAC/LSC表，该限制是32000字节。**
- 当超过上述字节限制时，LOB数据存入单独的大对象数据空间（可为其指定表空间），行内存储的则是指向LOB数据的指针。


|支持项|说明|
|---|---|
|基本SQL语法|1. 建表支持lob类型，支持指定行内以及行外存储。disable/enable storage in row
1. insert
1. update
1. select
|


  


参考：    [【YDBRD-13381】分布式支持大LOB测试设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133582282)  

|输入条件|场景|有效等价类|无效等价类|备注|
|:---|:---|:---|:---|:---|
|DML|insert/update值类型|'0'-'9'、'a'-'f'、'A'-'F'|其他英文字母（大小写）|drop table test2;    
  create table test2(id int, c1 blob);    
  insert into test2 values(1,'aaaa');    
  commit;    
  insert into test2 values(2,(select c1 from test2 where id=1));,update test2 set c1=(select c1 from test2 where id=1);|
|  
|  
|null，空串|空格串||
|  
|  
|子查询|特殊符号||
|  
|  
|函数表达式|中文，日文，韩文，西欧语言||
|  
|  
|  
|数值||
|  
|  
|  
|操作符表达式||
|  
|insert/update值长度|<=32000|>32000||
|  
|insert into on duplicate key update|  
|  
|  
|
|  
|insert all|  
|  
|  
|
|DDL|create table (a blob default值)|同上|同上|  
|
|  
|create table if not exists (a blob default值)|字符长度小于4000的常量字符串|字符长度超过4000的常量字符串|  
|
|  
|alter table add col default|函数返回值（字节长度<=32000）|函数返回值（字节长度>32000）|  
|
|  
|create table (a default,b default,...) as select blob 列|  
|  
|  
|
|DQL|投影列|单独查询|  
|  
|
|  
|  
|函数表达式|  
|  
|
|  
|filter 列|like/not like|>, <, =, !=, >=, <=|  
|
|  
|  
|exists/not exists|in/not in|  
|
|  
|  
|is null/is not null|between and|  
|
|  
|  
|case when|any/some/all|  
|
|  
|  
|union all|union|filter exists中的union优化为union all，第一个返回就可以？？|
|  
|  
|  
|join|  
|
|  
|结合其他|结合count|结合distinct|oracle不支持count，distinct，order by，group by|
|  
|  
|  
|结合order by|  
|
|  
|  
|  
|结合group by|  
|
|内置函数,  [内置函数支持情况-2024-05-30](https://conf.yasdb.com/pages/viewpage.action?pageId=153024911)  |字符函数|substr，lengthb，lpad，rpad，cast，concat，upper，lower，trim，find_in_set|instr，replace，position|~~oracle支持instr，replace~~|
|  
|聚集函数|count|max，min|  
|


|综合|  
|  
|  
|  
|  
|
|:---|:---|:---|:---|:---|:---|
|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|常量/变量|insert  table:,- blob数据列
- clob数据列
,create table ：,- blob数据列默认值
- clob数据列默认值
,alter table：,- blob数据列赋值
- 新增数据列的默认值
- clob数据列赋值,modify  （覆盖大变小，小变大）
- 新增clob数据列的默认值
|8000|正常插入，不报错；查询显示正确|/|/|
|  
|insert  table:,- blob数据列
- clob数据列
,create table ：,- blob数据列默认值
- clob数据列默认值
,alter table：,- 新增blob数据列的默认值
- clob数据列,modify  （覆盖大变小，小变大）
- 新增clob数据列的默认值
|31900|  
|32001|报错，无法插入或者更改|
|查询|上述用例场景，都需要覆盖length、lengthb函数|  
|  
|3|  
|


  


**测试重点：**

1.注意  ~~create table as~~  /insert into select 中类型转换

2.注意特殊处理的内置函数：    [内置函数支持情况-2024-05-30](https://conf.yasdb.com/pages/viewpage.action?pageId=153024911)  

**YashanDB对于LOB型的使用限制如下：**

不能作为索引列    
  不能修改LOB列的数据类型    
  不能作为分区键    
  不能与其他数据类型进行四则运算和取余运算    
  不能作为比较条件    
  不能使用DISTINCT去重    
  不能用于GROUP BY分组查询

# 2.LOB API

分布式不支持 select for update

  [分布式支持LOB更新删除以及API：详细设计 - 刘建中 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119542667)  

参考：    [YDBRD-12909 单机列表支持LOB API测试设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119552463)  

|类型|接口|
|---|---|
|blob|public int setBytes(long pos, byte[] bytes),public int setBytes(long pos, byte[] bytes, int offset, int len),public void truncate(long len)|
|clob|public int setString(long pos, String str),public int setString(long pos, String str, int offset, int len),public void truncate(long len)|


**1） jdbc **  **目录yasdb_jdbc_test/src/test/java/row/anchorlob**

|序号|用例|
|---|---|
|11|blobBaseDataTest.java|
|12|blobBigDataTest.java|
|4|BlobGetBinaryStreamTest.java|
|13|blobGetXxxTypeMapTest.java|
|14|blobJdbcTest.java|
|5|BlobMethodTest.java|
|15|blobSetXxxTypeMapTest.java|
|16|clobBaseDataTest.java|
|17|clobBigData1Test.java|
|18|clobBigData2Test.java|
|19|clobGetXxxTypeMapTest.java|
|20|clobJdbcTest.java|
|6|ClobMethodTest.java|
|21|clobSetXxxTypeMapTest.java|
|22|getRawTypeTest.java|
|7|LobSitCrossUse.java|
|1|lobstream/BlobGetBinaryStreamTest.java|
|2|lobstream/BlobStreamTest.java|
|3|lobstream/ClobStreamTest.java|
|8|RawHeapJDBCTest.java|
|9|SetClobReaderBigTest.java|
|10|SetClobReaderTest.java|
|23|xxxGetBlobTypeMapTest.java|
|24|xxxGetClobTypeMapTest.java|
|25|xxxSetBlobTypeMapTest.java|
|26|xxxSetClobTypeMapTest.java|


**2）c驱动**

yasdb-c-test/test_lob.h

**3) python 驱动**

yasdb_py_test/test_case/lob

  


## 3.JSON处理函数

**复用单机行表用例**

**json:160个用例文件**

FEATURE_PATH like '/function4/json%' and DEPLOY_MODE =1 and TABLE_TYPE =1 and VERSION ='dev' and "HIERARCHY" =2

**目录：/function4/json**

  


**复用分布式列表用例**

**json:131个用例文件**

FEATURE_PATH like '/function1/json%' and DEPLOY_MODE =2 and TABLE_TYPE =2 and VERSION ='dev' and "HIERARCHY" =2

**目录：/function1/json**

  


|支持项|说明|
|---|---|
|JSON处理函数|JSON(JSON_PARSE)，JSON_ARRAY_GET，JSON_ARRAY_LENGTH，JSON_EXISTS，JSON_FORMAT，JSON_QUERY，JSON_SERIALIZE，......|


  


  


# **4.详细测试记录**

|blob|测试项|不支持|
|---|---|---|
|ddl|增删列插入(带默认值，comments,约束，增删lob非lob混用多次）|  
|
|  
|create table（默认值无效，lob插入删除,约束）|不支持create table as|
|dml|delete（带不带filter）|  
|
|  
|insert|不支持insert into select中select 带常量： insert into test_zqLOB_tab_001_3_1(id,c5) (select 2,c5 from test_zqLOB_tab_001_3_1 where id=1);,  
|


  


## 复用用例目录：921

|  
|行表目录|目标目录|属性表|其他|
|---|---|---|---|---|
|nclob|  [standalone/testcase/datatype/nchar_nvarchar_nclob/nclob · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/datatype/nchar_nvarchar_nclob/nclob)  |  [https://git.yasdb.com/cod-test/yasft/-/tree/master/distribution/testcase/datatype/](https://git.yasdb.com/cod-test/yasft/-/tree/master/distribution/testcase/datatype/)  ,建目录nclob/heap|FEATURE_PATH ='/datatype/nchar_nvarchar_nclob/nclob' and DEPLOY_MODE =1 and TABLE_TYPE =1 and VERSION ='dev' and "HIERARCHY" =2|37|
|emptylob|  [standalone/testcase/datatype/Empty_lob · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/datatype/Empty_lob)  |  [https://git.yasdb.com/cod-test/yasft/-/tree/master/distribution/testcase/datatype/](https://git.yasdb.com/cod-test/yasft/-/tree/master/distribution/testcase/datatype/)  ,建目录emptylob/heap|FEATURE_PATH ='/datatype/Empty_lob' and DEPLOY_MODE =1 and TABLE_TYPE =1 and VERSION ='dev' and "HIERARCHY" =2|10|
|clob|  [standalone/testcase/lob_object/clob/heap · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/lob_object/clob/heap)  |  [distribution/testcase/datatype/clob · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/distribution/testcase/datatype/clob)  ,建目录heap|FEATURE_PATH like '/lob_object/clob/heap/%' and DEPLOY_MODE =1 and TABLE_TYPE =1 and VERSION ='dev' and "HIERARCHY" =2|346|
|blob|  [standalone/testcase/lob_object/blob/heap · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/lob_object/blob/heap)  |  [distribution/testcase/datatype_01/blob · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/distribution/testcase/datatype_01/blob)  ,建目录heap|FEATURE_PATH like '/lob_object/blob/heap/%' and DEPLOY_MODE =1 and TABLE_TYPE =1 and VERSION ='dev' and "HIERARCHY" =2|291|
|json函数|  [standalone/testcase/function4/json_array_get/heap · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/function4/json_array_get/heap)  ,  [standalone/testcase/function4/json_array_length/heap · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/function4/json_array_length/heap)  ,  [standalone/testcase/function4/json_exists/heap · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/function4/json_exists/heap)  ,  [standalone/testcase/function4/json_format/heap · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/function4/json_format/heap)  ,  [standalone/testcase/function4/json_parse/common · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/function4/json_parse/common)  ,  [standalone/testcase/function4/json_parse/heap · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/function4/json_parse/heap)  ,  [standalone/testcase/function4/json_query/heap · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/function4/json_query/heap)  |建目录 heap,  [distribution/testcase/function1/json_array_get · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/distribution/testcase/function1/json_array_get)  ,  [distribution/testcase/function1/json_array_length · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/distribution/testcase/function1/json_array_length)  ,  [distribution/testcase/function1/json_exists · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/distribution/testcase/function1/json_exists)  ,  [distribution/testcase/function1/json_format · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/distribution/testcase/function1/json_format)  ,  [distribution/testcase/function1/json_parse · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/distribution/testcase/function1/json_parse)  ,  [distribution/testcase/function1/json_query · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/distribution/testcase/function1/json_query)  |FEATURE_PATH like '/function4/json%/heap' and DEPLOY_MODE =1 and TABLE_TYPE =1 and VERSION ='dev' and "HIERARCHY" =2|136|
|json|  [standalone/testcase/datatype/json_extended/heap · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/datatype/json_extended/heap)  ,  [standalone/testcase/datatype/json_32MB/heap · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/datatype/json_32MB/heap)  ,  [standalone/testcase/datatype/json_datatype/heap · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/datatype/json_datatype/heap)  ,  [standalone/testcase/datatype/json_supplement/heap · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/datatype/json_supplement/heap)  |建目录heap,  [distribution/testcase/datatype_01/json · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/distribution/testcase/datatype_01/json)  |FEATURE_PATH like '/datatype/json%/heap' and DEPLOY_MODE =1 and TABLE_TYPE =1 and VERSION ='dev' and "HIERARCHY" =2|101|


|CLOB|  
|说明|当前状态|
|---|---|---|---|
|clob/common|test_sdv_LOB_QR_001,  
|不支持函数需修改预期，|少量直接替换预期|
|  
|test_sdv_LOB_QR_003|不支持DBMS_LOB高级包|少量直接替换预期|
|  
|test_sdv_LOB_QR_004|substr，暂不支持,YAS-00004 feature "parallel outLine lob" has not been implemented yet|需下架,![](https://pingcode.yasdb.com/atlas/files/public/67396e33a1ad9a3311dc95cd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM),  
|
|  
|test_sdv_LOB_QR_005|lob不能作为分区键+insert into select,YAS-00004 feature "redistribute by hash on heap table" has not been implemented yet|需下架,![](https://pingcode.yasdb.com/atlas/files/public/67396e348970c2af4f52175b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|
|  
|test_sdv_LOB_QR_006|不支持DBMS_LOB高级包|少量直接替换预期|
|  
|test_sdv_LOB_QR_007|不支持DBMS_LOB高级包,直接使用trim，ltrim函数行内：,YAS-00004 feature "parallel outLine lob" has not been implemented yet|少量直接替换预期|
|  
|test_sdv_LOB_QR_010|不支持DBMS_LOB高级包|少量直接替换预期|
|  
|test_sdv_LOB_QR_011|CONCAT,substr,YAS-00004 feature "parallel outLine lob" has not been implemented yet|少量直接替换预期,同  test_sdv_LOB_QR_011，可能是下推的原因,![](https://pingcode.yasdb.com/atlas/files/public/67396e348970c2af4f52175c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|
|  
|test_sdv_LOB_QR_012|一级分区表|需要修改创建表分区|
|  
|test_sdv_LOB_QR_013|不支持DBMS_LOB高级包,过程体|少量直接替换预期|
|  
|test_sdv_LOB_QR_013|不支持过程体|  
|
|  
|test_sdv_LOB_QR_014|不支持过程体|少量直接替换预期|
|  
|test_sdv_LOB_QR_015,test_sdv_LOB_QR_015_1,test_sdv_LOB_QR_015_2,test_sdv_LOB_QR_017,test_sdv_LOB_QR_017_1,  
|1.sys用户建heap表的表空间为user,需要替换预期,2.改为查查dv$segments视图，记录在dn上,3.分布表不支持clob指定表空间，system表空间，表空间集,待确认|1,2修改用例,3.删除用例|
|  
|test_sdv_LOB_QR_021|不支持DBMS_LOB高级包,|少量直接替换预期|
|  
|test_sdv_LOB_QR_022|查询视图DBA_SEGMENTS,更换为dv$segments视图|少量修改用例,![](https://pingcode.yasdb.com/atlas/files/public/67396e34a1ad9a3311dc95d0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|
|  
|test_sdv_LOB_QR_023|不支持DBMS_LOB高级包,|少量直接替换预期|
|  
|test_sdv_LOB_QR_024|查询视图DBA_SEGMENTS,更换为dv$segments视图|少量修改用例|
|  
|test_sdv_LOB_QR_025|有锁残留，待开发确认|已有单，|
|  
|test_sdv_LOB_QR_026|insert into return ，DBMS_LOB 不支持,YAS-04253 PL/SQL compiling errors:    
  [4:3] YAS-00004 feature "insert into returning in distribute" has not been implemented yet    
  [6:3] YAS-04371 unsupport DBMS_LOB in distributed database|少量直接替换预期|
|  
|test_sdv_LOB_QR_027|DBMS_LOB 不支持|少量直接替换预期|
|  
|test_sdv_LOB_QR_028|DBMS_LOB 不支持|下架，都是高级包测试|
|  
|test_sdv_LOB_QR_029|DBMS_LOB 不支持|少量直接替换预期|
|  
|test_sdv_LOB_QR_030|临时表不支持,YAS-04371 unsupport create temporary table in distributed database|下架|
|  
|test_sdv_lob_error_001|一级分区不支持非hash索引|少量修改用例|
|  
|test_sdv_lob_error_002|分区数目不符合规范|少量修改用例|
|  
|test_sdv_lob_error_003|create table as不支持|少量直接替换预期|
|  
|test_sdv_lob_sql_ddl_create_normal_001,---2,3,4,5,6,7,  
|clob不能作为分布建|修改用例|
|  
|test_sdv_lob_sql_ddl_create_normal_008|全为lob列，不支持|下架|
|  
|test_sdv_lob_sql_dml_insert_003|clob不能作为分布建|修改用例|
|  
|test_sdv_lob_sql_dml_insert_004_5,test_sdv_lob_sql_dml_insert_004_6,test_sdv_lob_sql_dml_insert_004_7,test_sdv_lob_sql_dml_insert_004_8,test_sdv_lob_sql_dml_insert_004_9,test_sdv_lob_sql_dml_insert_004_10|不支持过程体  test_sdv_lob_sql_dml_select_001|下架用例|
|  
|test_sdv_lob_sql_dml_select_001|通过insert into select插入数据， 触发了px的hash方法,  
|下架|
|  
|test_sdv_lob_sql_dml_select_003,test_sdv_lob_sql_dml_select_004|lob拼接，,YAS-00004 feature "parallel outLine lob" has not been implemented yet|少量直接替换预期|
|  
|test_sdv_lob_sql_dml_select_005|substr入参lob,YAS-00004 feature "parallel outLine lob" has not been implemented yet|下架|
|  
|test_sdv_lob_sql_dml_select_006|不支持create table as|下架|
|  
|test_sdv_lob_sql_dml_update_003|不支持,YAS-04514 distribute optimizer does not support with details 'update with correlated subquery on distribution database'|替换预期|
|  
|test_sdv_lob_sql_dml_update_005|不支持,YAS-04514 distribute optimizer does not support with details 'update with correlated subquery on distribution database',YAS-00004 feature "redistribute by hash on heap table" has not been implemented yet|替换预期|
|  
|test_sdv_lob_sql_temp_ddl_alter_001--,2,3,4,5,6,7,8,test_sdv_lob_sql_temp_ddl_alter_009,  
,test_sdv_lob_sql_temp_ddl_comment_001,  
,test_sdv_lob_sql_temp_ddl_create_normal_001,--2，3,4,5，6,7,8,test_sdv_lob_sql_temp_ddl_create_normal_009,test_sdv_lob_sql_temp_ddl_drop_001,test_sdv_lob_sql_temp_ddl_truncate_001,test_sdv_lob_sql_temp_dml_delete_001--,2,3,4,,test_sdv_lob_sql_temp_dml_insert_001--,2,3,4,5,test_sdv_lob_sql_temp_dml_select_001--,2,3,4,5,6,test_sdv_lob_sql_temp_dml_update_001--,2,3,4,5,  
,  
|不支持临时表,YAS-04371 unsupport create temporary table in distributed database|下架|
|  
|test_sdv_lob_storage_basic_001--,2,4,5，6,7,8,test_sdv_lob_storage_ddl_002|不支持指定自定义表空间|下架|
|  
|test_sdv_lob_storage_ddl_004|YAS-00004 feature "parallel outLine lob" has not been implemented yet|少量直接替换预期|
|  
|test_sdv_lob_storage_ddl_006|不支持 shrink space,YAS-00004 feature "alter shrink space on distributed" has not been implemented yet,  
|下架|
|  
|test_sdv_lob_storage_ddl_009--,10，11,12,13|不支持指定自定义表空间|下架|
|  
|test_sdv_lob_storage_disableinrow_001|clob 不能作为分布键|修改用例|
|  
|test_sdv_lob_storage_space_001--,2,3,4,  
|不支持指定自定义表空间|下架|
|  
|test_sdv_lob_storage_temp_basic_007,test_sdv_lob_storage_temp_basic_008,test_sdv_lob_storage_temp_ddl_001--,,2,4,5,6,7,9,10,11,12,13,test_sdv_lob_storage_temp_space_001--,3,4,test_sdv_lob_storage_temp_transcation_001--,2,3|不支持临时表|下架|
|  
|test_sdv_lob_storage_transcation_002--,3，4,  
|不支持指定自定义表空间|下架|
|  
|test_sdv_lob_suc_001|不支持create table as|下架|
|clob/clob_partition,  
,partition p1,,partition p2,,partition p3,,partition p4,,partition p5,,partition p6,,partition p7,,partition p8,,partition p9,,partition p10,,partition p11,,partition p12,,partition p13,,partition p14|test_sdv_lob_partition_ddl_001,test_sdv_lob_partition_ddl_002,test_sdv_lob_partition_ddl_006,test_sdv_lob_partition_ddl_007,test_sdv_lob_partition_ddl_008,test_sdv_lob_partition_ddl_011，,12,13,14,15,16,17,18,19,20,21,22,23,24,25，28，30，34，36，38,40，42,45，48，49，50,51,52,53,55,56,57，,  
,test_sdv_lob_partition_dml_001—28,30.，32,35，37，40,43，44，47,48，50,51|只支持hash分区|修改用例|
|  
|test_sdv_lob_partition_ddl_029,，33，35，37,39,41，44，46，49,54，58,test_sdv_lob_partition_dml_029，31，33,34,36，38,41，42,45,46，49,52|一级分区数量不符合规范|修改用例|
|  
|test_sdv_lob_partition_ddl_004,test_sdv_lob_partition_ddl_005,47，27,  
|不支持指定自定义表空间|下架|
|  
|test_sdv_lob_partition_ddl_043，,test_sdv_lob_partition_dml_025,test_sdv_lob_partition_dml_026,test_sdv_lob_partition_storage_038,test_sdv_lob_partition_storage_039|不能增删一级分区,![](https://pingcode.yasdb.com/atlas/files/public/67396e34a1ad9a3311dc95d1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|下架|
|  
|test_sdv_lob_partition_ddl_016,test_sdv_lob_partition_ddl_045,test_sdv_lob_partition_ddl_023,test_sdv_lob_partition_dml_001,test_sdv_lob_partition_dml_002,test_sdv_lob_partition_dml_028|不能truncate一级分区,![](https://pingcode.yasdb.com/atlas/files/public/67396e34a1ad9a3311dc95d2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|下架|
|  
|test_sdv_lob_partition_dml_016,test_sdv_lob_partition_dml_040,test_sdv_lob_partition_storage_015|不能按一级分区dml,![](https://pingcode.yasdb.com/atlas/files/public/67396e348970c2af4f52175d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|下架|
|  
|test_sdv_lob_partition_dml_048|不支持table merge ,![](https://pingcode.yasdb.com/atlas/files/public/67396e34a1ad9a3311dc95d3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|少量替换预期|
|  
|test_sdv_lob_partition_dml_051,test_sdv_lob_partition_dml_052|不支持,![](https://pingcode.yasdb.com/atlas/files/public/67396e348970c2af4f52175e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM),![](https://pingcode.yasdb.com/atlas/files/public/67396e348970c2af4f52175f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|少量替换预期|
|  
|test_sdv_lob_partition_ddl_048,test_sdv_lob_partition_ddl_049,test_sdv_lob_partition_ddl_050|不支持create table as|下架|
|  
|test_sdv_lob_partition_storage_001-36同上面三种,test_sdv_lob_storage_partition_disableinrow_001|  
|  
|
|  
|test_sdv_lob_partition_storage_002,3,4,5,6,7,9,10,11，12,13,14，16-28，31-36，40-49|不支持指定自定义表空间和系统表空间|下架|
|  
|test_sdv_varchar_size_004|分布式不支持--insert into ... on duplicate key update,insert column has query expression,  
,YAS-00004 feature "insert on duplicate key update with subquery" has not been implemented yet,YAS-04514 distribute optimizer does not support with details 'insert column has query expression'|修改预期|
|  
|test_sdv_varchar_size_005,6,7,8，9受到锁残留影响，未能成功建表|锁残留|---已解决|
|  
|test_sdv_varchar_size_004|lsc表用例|下架|
|  
|test_sdv_varchar_size_006|不支持create table as|下架|
|  
|test_sdv_varchar_size_009|分布式不支持,![](https://pingcode.yasdb.com/atlas/files/public/67396e34a1ad9a3311dc95d4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|替换预期拦截|


|BLOB|  
|说明|状态|
|---|---|---|---|
|blob_common|test_sdv_blob_sql_ddl_create_normal_001,test_sdv_blob_sql_ddl_create_normal_002,test_sdv_blob_sql_ddl_create_normal_004,5,6,7,8，,test_sdv_blob_sql_dml_insert_003（部分替换预期）|不支持blob作为分布键+预期替换,  
,test_sdv_blob_sql_dml_insert_003,![](https://pingcode.yasdb.com/atlas/files/public/67396e34a1ad9a3311dc95d5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|修改用例|
|  
|test_sdv_blob_sql_ddl_create_normal_003,10，11|不支持  （create table as）,![](https://pingcode.yasdb.com/atlas/files/public/67396e348970c2af4f521761/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|下架|
|  
|test_sdv_blob_sql_dml_insert_004_4,4_5,4_6,4_7,4_8|不支持过程体,  
|下架|
|  
|test_sdv_blob_sql_dml_insert_006|不支持  insert into on duplicate key update,![](https://pingcode.yasdb.com/atlas/files/public/67396e34a1ad9a3311dc95d6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|下架|
|  
|test_sdv_blob_sql_dml_insert_007|insert all  插入    
,![](https://pingcode.yasdb.com/atlas/files/public/67396e34a1ad9a3311dc95d7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|下架|
|  
|test_sdv_blob_sql_dml_select_002|![](https://pingcode.yasdb.com/atlas/files/public/67396e348970c2af4f521764/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|少量替换预期|
|  
|test_sdv_blob_sql_dml_select_001|![](https://pingcode.yasdb.com/atlas/files/public/67396e348970c2af4f521766/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|少量替换预期|
|  
|test_sdv_blob_sql_dml_select_006|分布式不支持外键,![](https://pingcode.yasdb.com/atlas/files/public/67396e34a1ad9a3311dc95da/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|修改用例|
|  
|test_sdv_blob_sql_dml_update_002|不支持,![](https://pingcode.yasdb.com/atlas/files/public/67396e34a1ad9a3311dc95db/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|少量替换预期|
|  
|test_sdv_blob_sql_dml_update_005|![](https://pingcode.yasdb.com/atlas/files/public/67396e34a1ad9a3311dc95dc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|少量替换预期|
|  
|test_ydbrd27356_yasldr_lob_null|![](https://pingcode.yasdb.com/atlas/files/public/67396e348970c2af4f52176a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|下架|
|blob_commom_01|test_sdv_blob_storage_basic_001,test_sdv_blob_storage_basic_002,  
|不支持lob列指定表空间,![](https://pingcode.yasdb.com/atlas/files/public/67396e35a1ad9a3311dc95de/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|下架|
|  
|test_sdv_blob_storage_basic_004,  
|改为tablespace set,![](https://pingcode.yasdb.com/atlas/files/public/67396e35a1ad9a3311dc95df/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|修改用例|
|  
|test_sdv_blob_storage_basic_005,test_sdv_blob_storage_basic_006|lob列和表存储在不同的tablespace，但是lob列不能指定表空间，所以下架|下架|
|  
|test_sdv_blob_storage_basic_007,test_sdv_blob_storage_basic_008|指定的表空间行内行外|修改用例|
|  
|test_sdv_blob_storage_ddl_001|分区键不能是唯一索引的子集，同tac表表现,![](https://pingcode.yasdb.com/atlas/files/public/67396e358970c2af4f52176b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|替换预期|
|  
|test_sdv_blob_storage_ddl_002|指定表空间增删列|修改用例|
|  
|test_sdv_blob_storage_ddl_006|指定表空间shrink table|下架|
|blob_partition|test_sdv_blob_partition_ddl_001,test_sdv_blob_partition_ddl_002,test_sdv_blob_partition_ddl_003,6，7,8，10，11,12,13,14,15,16，171,8,19,20，22，24,25，26，28,29,30,31_32,33,34，,test_sdv_blob_partition_dml_001-7,9-52,  
,test_sdv_blob_partition_storage_001,8-14|只支持hash分区,![](https://pingcode.yasdb.com/atlas/files/public/67396e35a1ad9a3311dc95e0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|修改用例|
|  
|test_sdv_blob_partition_storage_015,test_sdv_blob_partition_storage_049|shrink table|下架|
|  
|test_sdv_blob_partition_ddl_004,test_sdv_blob_partition_storage_002,3，4，5，6，7|不支持自定义表空间和系统表空间|修改为tablespace set|
|  
|test_sdv_blob_partition_ddl_005|要让分区键，lob列位于不用的表空间，不支持|下架|
|  
|test_sdv_blob_partition_ddl_021,43,45,test_sdv_blob_partition_storage_038,39|增删分区，不支持，|下架|
|  
|test_sdv_blob_partition_ddl_023|truncate分区，不支持|下架|
|  
|test_sdv_blob_partition_ddl_027|带  lob  列的表，自建表空间，不支持|下架|
|  
|test_sdv_blob_partition_ddl_047,59|分布式不支持外键,![](https://pingcode.yasdb.com/atlas/files/public/67396e358970c2af4f52176c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|下架|
|  
|test_sdv_blob_partition_ddl_048,49，50|create table as不支持|下架|
|  
|test_sdv_blob_partition_dml_007|insert into on duplicate key update  插入  ---不支持|下架|
|  
|test_sdv_blob_partition_dml_008|insert all--不支持|下架|
|  
|test_sdv_blob_partition_storage_016,17,test_sdv_blob_partition_storage_040,41-48,  
|不支持闪回,回收站回收,,,![](https://pingcode.yasdb.com/atlas/files/public/67396e358970c2af4f52176d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|下架|
|  
|test_sdv_blob_partition_storage_020-28,32-36，40-48|改为tablespace set|  
|
|blob_sit|test_sdv_lob_sit_001,3|不支持create table as,但是报错：YAS-00004 feature "heap table on distributed" has not been implemented yet,![](https://pingcode.yasdb.com/atlas/files/public/67396e358970c2af4f52176e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|下架|
|  
|test_sdv_lob_sit_004|不支持触发器,![](https://pingcode.yasdb.com/atlas/files/public/67396e358970c2af4f521770/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|  
|
|  
|test_sdv_lob_sit_005|只支持hash分区|修改用例|
|  
|test_sdv_lob_sit_006|不支持cursor,![](https://pingcode.yasdb.com/atlas/files/public/67396e35a1ad9a3311dc95e2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|下架|
|blob_temp_001,blob_temp_002|不支持临时表|  
|全部下架|
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


|empty_lob|用例|说明|状态|
|---|---|---|---|
|  
|test_sdv_empty_lob_003,4,6，7|clob列不能作为分布键,存在问题：application area不足,![](https://pingcode.yasdb.com/atlas/files/public/67396e358970c2af4f521772/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|修改用例|
|  
|test_sdv_empty_lob_008|不支持函数|下架|
|  
|test_sdv_empty_lob_010|不支持高级包，跨行lob计算|下架|


|nclob|用例|说明|状态|
|---|---|---|---|
|  
|test_sdv_nclob_datatype_04,5,6，12，23，24，25,26，28，41,42,46|clob列不能作为分布键|修改用例|
|  
|test_sdv_nclob_datatype_10,test_sdv_nclob_datatype_40|dbms_metadata.get_ddl不一样，刷预期,不支持create table as的报错信息不合理,![](https://pingcode.yasdb.com/atlas/files/public/67396e35a1ad9a3311dc95e4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM),  
|已有单|
|  
|test_sdv_nclob_datatype_36|clob列不能作为分布键–修改用例,分区键不是唯一约束键的子集--替换预期,![](https://pingcode.yasdb.com/atlas/files/public/67396e35a1ad9a3311dc95e5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|修改用例|
|  
|test_sdv_nclob_datatype_44|clob列不能作为分布键+TABLESPACE改为set|修改用例|
|  
|test_sdv_nclob_datatype_45,47，48，49,51,52|不支持,![](https://pingcode.yasdb.com/atlas/files/public/67396e35a1ad9a3311dc95e7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM),  
|替换预期|
|  
|test_sdv_nclob_datatype_62,63,64|高级包 ,dbms_lob|下架|
|  
|test_sdv_nclob_datatype_53|不支持merge into table,![](https://pingcode.yasdb.com/atlas/files/public/67396e35a1ad9a3311dc95e8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|下架|
|  
|test_sdv_nclob_datatype_12|查询4096列失败，待问题确认,  
,![](https://pingcode.yasdb.com/atlas/files/public/67396e358970c2af4f521775/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|  
|


|json|  
|  
|  
|
|---|---|---|---|
|json_datatype|–已废弃 下架|  
|  
|
|json_32M|–已废弃 下架|  
|  
|
|json_extended|–已废弃 下架|  
|  
|
|json_supplement|–已废弃 下架|  
|  
|
|json_format|test_heap_json_format_10|不支持,![](https://pingcode.yasdb.com/atlas/files/public/67396e35a1ad9a3311dc95e9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|少量替换预期|
|json_parse|test_sdv_json_028|create table as 不支持，错误信息待修改|  
|
|  
|test_sdv_json_029|触发了px执行，不支持，替换预期,![](https://pingcode.yasdb.com/atlas/files/public/67396e358970c2af4f521776/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|  
|
|  
|test_sdv_json_034|存储过程不支持|下架|
|json_query|test_heap_json_query_22,31,4  0|排序结果不一致，但是本地没复现出来,![](https://pingcode.yasdb.com/atlas/files/public/67396e35a1ad9a3311dc95ea/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|  
|
|  
|test_heap_json_query_52|不支持，,![](https://pingcode.yasdb.com/atlas/files/public/67396e368970c2af4f521777/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|替换预期|
|  
|test_heap_json_query_53|不支持,![](https://pingcode.yasdb.com/atlas/files/public/67396e368970c2af4f521778/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM)|替换预期|
|  
|test_heap_json_query_54|与单机不一致，,![](https://pingcode.yasdb.com/atlas/files/public/67396e368970c2af4f52177a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0F3Q3lId0FvQUVBQUFNQ0Fnd0FBZ0FDQU1BS0FBUUFsQUFTUUFBQUd3QUUwQUFrREFBRUpPSVFnRWlqQjZKTUxKd3dFZ1dRUVFBQ0JLQkFBRWhnSUVJcENRQkRoQVJDQUVDRUNCQUFCQUFJaUFBUkFBQlFFUXdJUVFDTlVDQUFVZkRSQVFvSUFvR0tLQklDQUFoZ0FBUUVBQUVnQUlYUUVRS0FDQUVTRE1JPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEwNTcsImV4cCI6MTc4MjM4MTg1N30.DJXHi7T7fe2UepohjTSpScr5ODhZ6XshGbZU007cQvM),drop table if exists test_heap_json_query_54;    
  create table test_heap_json_query_54(    
  id int,    
  c1 varchar(100),    
  c2 varchar(128)    
  ) organization heap;,insert into test_heap_json_query_54 values(1, '{"a":1, "b":1}', '{"a":1, "b":1}');    
  insert into test_heap_json_query_54 values(2, '{"a":2, "b":2}', '{"a":2, "b":2}');    
  insert into test_heap_json_query_54 values(3, '{"a":3, "b":3}', '{"a":3, "b":3}');    
  insert into test_heap_json_query_54 values(4, '{"a":4, "b":4}', '{"a":4, "b":4}');    
  commit;    
  select (select count(*) from test_heap_json_query_54 where json_query(json(c1), '$.a' returning varchar(100))=1)/(select count(*) from test_heap_json_query_54) from dual;|待确认|


# 5.   **测试框架设计**

本次测试采用guider测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


  


  


  


  


## Attachments:

[image2024-6-17_18-21-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzFhMWFkOWEzMzExZGM5NWE4IiwicmVmX2lkIjoiNjczOTZlMzE3MjgyMDZlZmI5MmYyNmQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMDU3LCJleHAiOjE3ODI0NTc0NTd9.ZRC1KzHMMghSQXcMWYH6qtRYYhR8A0MYyU2_1iggHEg)

 (image/png)    


[image2024-6-18_15-38-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzE4OTcwYzJhZjRmNTIxNzM4IiwicmVmX2lkIjoiNjczOTZlMzE3MjgyMDZlZmI5MmYyNmQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMDU3LCJleHAiOjE3ODI0NTc0NTd9.5HlXTkom6TRcL9aZcvaeaDv0BQc6ldaoRyo2f_PKyG0)

 (image/png)    


[image2024-6-28_17-53-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzI4OTcwYzJhZjRmNTIxNzRhIiwicmVmX2lkIjoiNjczOTZlMzE3MjgyMDZlZmI5MmYyNmQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMDU3LCJleHAiOjE3ODI0NTc0NTd9.RKMV1dyVczWOBlalWo6yEemFkLgEcV944Um2oHPkKjk)

 (image/png)    


[image2024-7-3_11-49-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzI4OTcwYzJhZjRmNTIxNzUwIiwicmVmX2lkIjoiNjczOTZlMzE3MjgyMDZlZmI5MmYyNmQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMDU3LCJleHAiOjE3ODI0NTc0NTd9.BfTyw_sAETUYE6JKl4VFVNZABnoQi4GQgmKCUYujWCs)

 (image/png)    


[image2024-7-4_16-51-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzM4OTcwYzJhZjRmNTIxNzU0IiwicmVmX2lkIjoiNjczOTZlMzE3MjgyMDZlZmI5MmYyNmQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMDU3LCJleHAiOjE3ODI0NTc0NTd9.4i9FqOAqFQaa38Zv0GNpSZM7BZgqs0bkHx0J_QK-G2A)

 (image/png)    


## Comments:

|  [](null)  ,新华建议：,1.注意create table as/insert into select 中类型转换,2.注意特殊处理的内置函数：    [内置函数支持情况-2024-05-30](153024911.html)  ,3.YashanDB对于LOB型的使用限制如下：,不能作为索引列    
  不能修改LOB列的数据类型    
  不能作为分区键    
  不能与其他数据类型进行四则运算和取余运算    
  不能作为比较条件    
  不能使用DISTINCT去重    
  不能用于GROUP BY分组查询,Posted by lichao at 六月 11, 2024 14:33|
|---|
|  [](null)  ,标题：YDBRD-26067 & YDBRD-18281 分布式支持行表DML、DQL、LOB、JSON测试设计评审,时间：2024/06/12 16:00-17:00,与会成员：黄家华，施新华，刘美秀，李潮，冯浩楠，李晶,腾讯会议：163-635-288,会议纪要：,1.dml与lob相关用例注意去重,2.支持nclob，nclob字节数为clob一半,3.lob特性行内存储限制与行表对齐,Posted by lichao at 六月 12, 2024 16:34|
