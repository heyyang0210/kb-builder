Created by 刘建中, last modified on 七月 07, 2023

**JIRA：**    [YDBRD-13382](https://jira.yasdb.com/browse/YDBRD-13382)  

**JIRA：**    [YDBRD-13383](https://jira.yasdb.com/browse/YDBRD-13383)  

# 1 overview（概述）

*简要说明本设计方案的背景、需求。*

目前分布式下对outline的LOB支持情况为：LOB的写入和查询；部分LOB API，如LOB_READ，LOB_GET_LENGTH等。需要在此基础之上，实现分布式下LOB的更新和删除，以及完整的LOB API。

在存储模块：目前已经实现了LOB的更新和删除，已经提测。存储模块的LOB API，目前还在开发中。

参考信息：

-   [LOB协议](https://conf.yasdb.com/pages/viewpage.action?pageId=68294902)  
-   [LSC表Outline LOB存储方案](https://conf.yasdb.com/pages/viewpage.action?pageId=104203899)  
-   [单机列存CLOB类型支持](https://conf.yasdb.com/display/YAS/LOB)  
-   [分布式支持大Lob写入、查询设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=112725825)  


# 2 Features（功能特性）

*说明本方案的功能特性。*

|功能|设计表现|设计说明|
|:---:|:---:|:---:|
|分布式支持Outline LOB更新|分布式系统更新大LOB数据|  
|
|分布式支持Outline LOB删除|分布式系统里删除大LOB相关数据|  
|
|分布式支持完整LOB api操作|支持通过api方式操作大LOB数据|  
|


**表1**

# 3 Interfaces（接口）

*列出本方案对外提供的接口、配置参数、API等。*

## 3.1 外部接口

1)  update和delete功能接口，包括：SQL直接执行；绑定参数执行等方式。

2）对外的LOB API。完整的LOB API支持如下表：

|**类型**|**说明**|**方法**|**参数**|**返回值**|
|:---:|:---:|:---:|:---:|:---:|
|  
,  
,  
,  
,  
,Blob|将给定的字节数组写入 BLOB（从给定的位置开始），然后返回写入的字节数|public int setBytes(long pos, byte[] bytes)|pos BLOB中开始写入数据的位置（从 1 开始）bytes要写入 BLOB 的字节的数组|包含写入的字节数的 int|
||从给定的位置开始根据偏移量和长度，将给定字节数组的全部或部分写入 BLOB，然后返回写入的字节数|public int setBytes(long pos, byte[] bytes, int offset, int len)|pos    
  BLOB 中开始写入数据的位置（从 1 开始）。    
  bytes    
  要写入 BLOB 的字节的数组。    
  offset    
  字节数组中要从 byte 数组开始读取数据的位置的偏移量。    
  len    
  要尝试从字节数组读入 BLOB 的字节数。|包含写入的字节数的 int|
||将 BLOB 截断至给定长度|public void truncate(long len)|len BLOB 的新长度|  
|
|  
,  
,  
,Clob|将给定的 String 写入 CLOB（从给定位置开始）|public int setString(long pos, String str)|pos开始写入 CLOB 的位置s要写入 CLOB 的 String|写入的字符数|
||根据给定的偏移量和长度，将给定的字符串写入 CLOB（从给定的位置开始）|public int setString(long pos, String str, int offset, int len)|pos    
  开始写入 CLOB 的位置    
  str    
  要写入 CLOB 的字符串    
  offset    
  字符串中的偏移量，从这个位置开始读取字符    
  len    
  将要写入的字符数|写入的字符数|
||将 CLOB 截断为给定的长度|public void truncate(long len)|len CLOB 应截断为的长度（以字符数表示）|  
|


                                                                                                                                                                                          **表2**

## 3.2 内部接口

```
// 读取LOB
CodResult anlDstbReadLobData(AnlStmt* stmt, VarLob* lob, CodUint32 offset, CodChar* buffer, CodUint32 size);

// 发送数据
CodResult anlDstbSendLobData(AnlHandler* handler, CodUint16 dstEndpoint, DstbLobHead* lobHead, ReqLob* reqLob);
```

# 4 Limitations（功能限制）

*说明本方案对外的功能限制或约束。*

## 4.1 规格

|大对象类型|范围|说明|
|:---:|:---:|:---:|
|CLOB|1~4G*DB_BLOCK_SIZE|主要关注100MB以下|
|BLOB|1~4G*DB_BLOCK_SIZE|  
|


                                                                   **表3**

规格说明与之前的概要设计和详细设计方案里保持一致，可以参考：    [分布式支持大Lob写入、查询设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=112725825)    （4.1 规格）

## 4.2 约束

- clob/blob不支持 min/max 聚合
- clob/blob不支持distinct


>   `select distinct f_clob from test_lob  
`  

- clob/blob不支持作为group by key


>   `select count(f_clob) from test_lob group by f_clob;  
`  

- clob/blob不支持作为order by key


>   `select * from test_lob order by f_clob;  
`  

- clob/blob不支持作为join key


>   `select * from test_lob, test_lob_join where test_lob.f_clob = test_lob_join.f_clob;  
`  

- clob/blob不支持集合操作UNION, INTERSECT, MINUS


>   `select * from test_lob union select * from test_lob_join;  
`  

- 不支持= , !=, >, >=, <, <=, <>, ^=， int/not int/any/all/some/BETWEEN/GREATEST/LEAST


> 【注】同单机版本保持一致。

  [https://docs.oracle.com/en/database/oracle/oracle-database/21/adlob/supported-functions-and-operators.html#GUID-10C6706D-CE73-4E21-A2B1-55F11A27A6EF](https://docs.oracle.com/en/database/oracle/oracle-database/21/adlob/supported-functions-and-operators.html#GUID-10C6706D-CE73-4E21-A2B1-55F11A27A6EF)  

# 5 Detail Design（详细设计）

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

## 5.1 架构

分布式下的LOB执行架构如下图所示：

![](https://conf.yasdb.com/download/attachments/104215255/lob_frame.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFGQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE0OTIsImV4cCI6MTc4MjMwMjI5Mn0.ihk2IxRyEHa1zAR3wrPVRgfHXssollH9QgChohYzn8Q)

**图1**

使用LOB协议场景

|客户端|服务端|通讯通道|使用场景|协议说明|
|:---|:---|:---|:---|:---|
|Client|CN|客户端链路|客户端驱动进行SQL操作|原始LOB协议|
|CN|DN|ICS链路，数据通道|由client驱动向数据节点传输数据|分布式LOB协议|
|DN|DN|ICS链路，数据通道|SQL执行期间按需跟目标节点传输数据|分布式LOB协议|


> 【注】分布式LOB协议是指在分布式下，需要给原始的LOB协议消息上增加分布式的头，本质上还是LOB协议。

## 5.2 LOB更新

以client的如下update方式作为例子：

```
clob = conn.createClob();
//若干次clob.setString()
PreparedStatement pstmt = conn.prepareStatement("update tb_cbdt1 set c1=?");
pstmt.setClob(1, clob);
pstmt.executeUpdate();
clob.free();
```

其执行流程如下图所示：

![](https://pingcode.yasdb.com/atlas/files/public/67396b2ba1ad9a3311dc80bd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFGQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE0OTIsImV4cCI6MTc4MjMwMjI5Mn0.ihk2IxRyEHa1zAR3wrPVRgfHXssollH9QgChohYzn8Q)

                                                                                                                              **图2**

## 5.3 LOB删除

以client的如下delete方式作为例子：

```
Statement stmt = conn.createStatement();
stmt.execute("delete from tb_cbdt1 where id=1");
conn.commit();
```

Delete的执行过程比较简单，不涉及到LOB的读取，只要在DN存储层实现了lob rowdelete即可以完成。其执行流程如下图所示：

![](https://pingcode.yasdb.com/atlas/files/public/67396b2b8970c2af4f520248/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFGQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE0OTIsImV4cCI6MTc4MjMwMjI5Mn0.ihk2IxRyEHa1zAR3wrPVRgfHXssollH9QgChohYzn8Q)

                                                                                                                       **图3**

## 5.4 LOB API

对分布式下lob write和lob trim的api使用，做下重点说明：

write和trim(truncate)有两种使用场景：①对temp lob的操作；②对实际lob的操作。

场景②需要回写表，一般使用select for update的方式，示例代码如下：

```
Statement stmt = conn.createStatement();
ResultSet rs = stmt.executeQuery("select c1 from tb_clobmd1 for update");
Assert.assertTrue(rs.next());
Clob clob = rs.getClob(1);
clob.truncate(3072);
```

由于在YashanDB目前在分布式下不支持 select for update，因此在本次迭代，暂不支持②这种回写表的情况场景。

***注：***  如果直接select得到lob后，调用write/truncate api回写表，在Oracle和YashanDB，都会提示报错。

# 6 Test Cases（测试用例）

*设计开发人员自测用例（文字描述）。*

**1) LOB 更新和删除**

|序号|场景|预期结果|
|:---:|:---:|:---:|
|1|对包含CLOB/BLOB列的表，直接SQL方式执行Delete|正常执行，指定行被删除。|
|2|对包含CLOB/BLOB列的表，绑定参数方式执行Delete|正常执行，指定行被删除。|
|3|对包含CLOB/BLOB列的表，直接SQL方式执行Update|正常执行，列被更新。|
|4|对包含CLOB/BLOB列的表，绑定参数方式执行Update|正常执行，列被更新。|


**2）LOB API**

|序号|场景|预期结果|
|:---:|:---:|:---:|
|1|创建temp lob，调用setString|正常执行，写入string|
|2|创建temp lob，调用setBytes|正常执行，写入bytes|
|3|创建temp lob，调用truncate|正常执行，lob被截取指定长度|


# 7 Workload（工作量）

*评估代码量KLOC、工作量（人天）。*

本方案涵盖两个SR：LOB更新删除；LOB API。总共工作量约1人周。

# 8 References（参考文档）

主要参考了Confluence上关于LOB的文章，之前LOB的概要设计，以及LOB写入和查询的设计文档。

# 9 TODO（遗留问题）

*说明本方案遗留的问题或下一步需要解决的问题。*

  


## Attachments:

[当前实现方式.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMmFhMWFkOWEzMzExZGM4MGI2IiwicmVmX2lkIjoiNjczOTZiMmE3MjgyMDZlZmI5MmYwMjczIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxNDkyLCJleHAiOjE3ODIzNzc4OTJ9.KEtROEBjxanuYFT48gBO3B3mSPVE0WaDtNrABwfinyE)

 (image/png)    


[SQL直接执行.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMmE4OTcwYzJhZjRmNTIwMjQxIiwicmVmX2lkIjoiNjczOTZiMmE3MjgyMDZlZmI5MmYwMjczIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxNDkyLCJleHAiOjE3ODIzNzc4OTJ9.5hbAe1zH6B4rT9l1mIyKvIfGjf3Nmb5JKrlGW02kVBY)

 (image/png)    


[绑定参数执行.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMmFhMWFkOWEzMzExZGM4MGI3IiwicmVmX2lkIjoiNjczOTZiMmE3MjgyMDZlZmI5MmYwMjczIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxNDkyLCJleHAiOjE3ODIzNzc4OTJ9.Vl5j1lPGldL9TZFR51ISmHsK0TQD51YF8oOtXkT3Fzs)

 (image/png)    


[LOB-update.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMmFhMWFkOWEzMzExZGM4MGI4IiwicmVmX2lkIjoiNjczOTZiMmE3MjgyMDZlZmI5MmYwMjczIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxNDkyLCJleHAiOjE3ODIzNzc4OTJ9.W2bcpR5TMWiOfrSMuRM0fQAKxmscGygIZQEc2aW87co)

 (image/png)    


[LOB-delete.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMmJhMWFkOWEzMzExZGM4MGI5IiwicmVmX2lkIjoiNjczOTZiMmE3MjgyMDZlZmI5MmYwMjczIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxNDkyLCJleHAiOjE3ODIzNzc4OTJ9.8qroKCd7Cl570lc_yApZGLasANUvEFkl0rSKtAqwcMA)

 (image/png)    
