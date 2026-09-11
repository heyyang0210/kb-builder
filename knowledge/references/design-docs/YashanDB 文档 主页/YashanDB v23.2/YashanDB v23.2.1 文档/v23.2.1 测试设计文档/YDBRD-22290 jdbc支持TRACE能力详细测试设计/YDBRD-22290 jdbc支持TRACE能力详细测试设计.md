Created by 李潮, last modified on 十二月 12, 2023

# **1. 概述**

IR：    [YDBRD-18700](https://jira.yasdb.com/browse/YDBRD-18700?src=confmacro)    -  JDBC Driver增加TRACE功能  完成

SR:    [YDBRD-22290](https://jira.yasdb.com/browse/YDBRD-22290?src=confmacro)    -  【jdbc】支持TRACE能力  完成

参考：开发设计文档：    [jdbc支持trace - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133575955)  

调研文档：    [YDBRD-18700 JDBC Driver增加TRACE功能测试调研 - 赵育 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133581480)  

jdbc客户端在日志Trace级别，对四个主要功能的执行时间和流程进行记录，方便性能问题跟踪定位确认是客户端问题还是服务端问题。

# **2. 需求分析**

## 2.1 功能介绍

1.jdbc客户端日志功能支持两种门面技术  ：SLF4J和JCL。门面技术可配置   java原生的JUL，另外SLF4J支持  log4j ，log4j2、logback、SLF4J等三方件。通过JUL或三方件控制日志输出信息。

2.对connection的获取连接 执行进行记录

开始：  **connect start**  ,timestamp:{},url的ip信息和端口信息

结束：  connect end,timestamp:{},sission id:{},connectVersion:{}

3.对connection的关闭连接执行进行记录

开始：  **connect close start**  ,timestamp:{},sission id:{}

结束：connect close   end  ,timestamp:{},sission id:{}

4.对preparement，precall进行记录

开始：  prepare start,timestamp:{},session id:{}, sql:{}

结束：  prepare end,timestamp:{},session id:{},statement id:{}

5.对preparement.excute，precall.excute进行记录

开始：prepareStatement execute start,timestamp:{},session id:{}, Statement id:{}

结束：prepareStatement execute end,timestamp:{},session id:{}, Statement id:{}

6.对.excute进行记录

开始：statement execute start,timestamp:{},session id:{}, Statement id:{},sql:{}

结束：statement execute end,timestamp:{},session id:{}, Statement id:{}

7.对resultset.fetch进行记录

开始：  fetchMore start,timestamp:{},session id:{}, Statement id:{}    
  结束：  fetchMore end,timestamp:{},session id:{}, Statement id:{}

8.如果执行语句时中途抛出异常，不能正常打印end记录

**stmt.excute("")--------statement excute start未有id，**  **end包含id**

## 2.2 规格约束

无

# **3 详细测试设计**

  


采用流程分析法分析出基准流：

**预置条件：配置**  **SLF4J门面，log4j2三方件，设置文件输出模式，配置trace日志级别。**

**场景1：连接测试——**  java.sql.Driver，javax.sql.DataSource，com.yashandb.jdbc.YasDataSource，com.yashandb.jdbc.pool.YasConnectionPoolDataSource

基本流1：通过DriverManager创建连接，关闭connection。

备选流1：创建连接时输入无效信息（url/用户名/密码）

备选流2：通过DataSource创建连接，关闭connection。

备选流3：通过YasDataSource创建连接，关闭connection。

备选流4：通过YasConnectionPoolDataSource创建连接，关闭connection。

**场景2：statement创建执行测试——**  java.sql.Statement

基本流2：创建连接，创建Statement，执行创建表语句，执行数据插入，关闭statement，关闭connection。

备选流1：创建连接，创建Statement，执行创建表语句，执行语法错误的语句进行数据插入，关闭statement，关闭connection。

备选流2：创建连接，创建Statement，执行创建表语句，执行数据插入，关闭connection，关闭statement。

**场景3：fetch测试——**  java.sql.ResultSet，  java.sql.ResultSetMetaData,  java.sql.DatabaseMetaData

基本流3：创建连接，创建Statement，执行创建表语句，执行连续插入10条数据，查询表数据，通过next()取出所有数据，关闭statement,关闭connection。

备选流1：创建连接，创建Statement，执行创建表语句，执行连续插入20条数据，查询表数据，通过next()取出所有数据，关闭statement,关闭connection。

**场景4：preparement测试——**  java.sql.PreparedStatement

基本流4：创建连接，执行创建表语句，创建preparement，执行批量插入，删除，更新数据，关闭statement,关闭connection。

备选流1：创建连接，执行创建表语句，创建preparement，执行语法错误语句进行插入，关闭statement,关闭connection。

**场景5：precall测试——**  java.sql.CallableStatement

基本流5：创建连接，执行创建表语句，创建precall调用函数，执行precall，关闭precall,关闭connection。

备选流1：创建连接，执行创建表语句，创建precall调用语法错误的过程体，执行precall，关闭precall,关闭connection。

**场景6：设置日志级别debug，执行场景3备选流2。**

**场景7：性能问题定位测试——并发测试**

基本流：DML并发，执行错误语法sql，大数据量。

**场景8：性能问题定位测试——并发测试，关闭trace日志，用于对比开启trace时间**

基本流：DML并发，执行错误语法sql，大数据量。

###########################################################################################################

专项测试设计情况：

|专项|是否涉及|
|:---|:---|
|并发|是|
|可靠性|否|


# **4 文本用例**

# **5 测试用例**

  
    


# **5 测试框架设计**

Gradle

## Attachments:

[文本用例模板.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWU4OTcwYzJhZjRmNTIwNjRkIiwicmVmX2lkIjoiNjczOTZiYWU3MjgyMDZlZmI5MmYwOGYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MjYwLCJleHAiOjE3ODIzODI2NjB9.JM-GyxSz4Jwiq4zwW_Zj6CjF4-OhGs-4CXIS5WsAeDY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[文本用例模板.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWU4OTcwYzJhZjRmNTIwNjRlIiwicmVmX2lkIjoiNjczOTZiYWU3MjgyMDZlZmI5MmYwOGYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MjYwLCJleHAiOjE3ODIzODI2NjB9.Yx7XJ-doP-uMsL_165ljwaEhDapk5mgAdjU0Z6Nub48)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[TestTraceLog.java](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWVhMWFkOWEzMzExZGM4NGM0IiwicmVmX2lkIjoiNjczOTZiYWU3MjgyMDZlZmI5MmYwOGYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MjYwLCJleHAiOjE3ODIzODI2NjB9.jD12_lLWUMA9stW14qxKeVSRHOerq9JPd8Ijfh0Il6g)

 (text/x-java-source)    


[TestTraceLogParralel.java](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWVhMWFkOWEzMzExZGM4NGM1IiwicmVmX2lkIjoiNjczOTZiYWU3MjgyMDZlZmI5MmYwOGYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MjYwLCJleHAiOjE3ODIzODI2NjB9.rh2ddSxpmWHOH8OGNvMI39BMQ4R75_db2ekE8_UX548)

 (text/x-java-source)    


[log4j2.xml](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWU4OTcwYzJhZjRmNTIwNjRmIiwicmVmX2lkIjoiNjczOTZiYWU3MjgyMDZlZmI5MmYwOGYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MjYwLCJleHAiOjE3ODIzODI2NjB9.WSEiDCD91UPXo-bmBh6chpB8EhqRlj1xSgY2jPqYtvM)

 (text/xml)    


## Comments:

|  [](null)  ,会议纪要：,与会人：李潮，张周玺，赵育，郑思远    
  会议时间：2023/11/03 15:30-16:30     
  腾讯会议：732-124-199    
  纪要信息：    
  1.影响接口包含：连接connection，语句statement，结果集resultset。    
  2.在正常情况下日志具体信息，在执行返回异常情况下，无日志结束打印。,问题记录：,1.打印的时间戳时间单位为毫秒，时区：北京时间,2..打印statement start时未与服务端进行连接，未获取statement id，打印statement end与服务端进行连接，获取到statement id,评审通过与否：通过,Posted by lichao at 十二月 12, 2023 15:01|
|---|
