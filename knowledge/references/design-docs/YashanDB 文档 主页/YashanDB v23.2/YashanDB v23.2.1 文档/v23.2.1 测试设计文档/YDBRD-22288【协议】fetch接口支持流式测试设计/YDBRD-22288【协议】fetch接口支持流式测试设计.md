Created by 郑思远, last modified on 十一月 23, 2023

# 1.   **概述**

本文描述 jdbc对fetch接口支持流式的测试设计

# 2.   **需求分析**

**SR：**    [YDBRD-22288](https://jira.yasdb.com/browse/YDBRD-22288?src=confmacro)    **-**  **【协议】fetch接口支持流式**  **完成**

设计文档  **：**    [流式发送设计方案 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133562512)  

  


1）背景：  一应一答的fetch模式  查询性能差

  [clickHouse查询性能高于崖山的原因分析 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=115147783)  

  


2）应用场景：优化大数据量的查询性能

主要思想：

客户端：  流式fetch只请求1次

服务端：

连续  发送结果，直到发完或者Socket阻塞；

如果客户端没有接收完，服务端一直推送fetch结果；  在此过程中设有阻塞时长，超时报错退出

  


3）具体功能：

客户端：

i）jdbc开启流式fetch的配置，两种形式：

a.   stmt.enableStreamResultSet()

   stmt.disableStreamResultSet()

b.   stmt  .setFetchSize  (  Integer  .  MIN_VALUE  )  ; 

       

ii）jdbc url中配置超时参数  streamingResultNetTimeout，默认值600秒

  


服务端：

增加  PACKET_SEND_TIMEOUT参数表示报文发送最大阻塞时间；

如果客户端同时设置了streamingResultNetTimeout，则超时时间以streamingResultNetTimeout为准

  


4）功能限制：

一个连接下的2个stmt，结果集用流式的方式fetch，需要一个stmt fetch完或者把结果集关掉，另一个stmt才能进行下一次查询，否则抛异常

# 3.   **测试设计方法**

0）冒烟

1）接口测试

2）配置参数

3）性能 

4）功能测试

5）并发

6）兼容性

# 4.   **详细测试设计**

以下用例无特殊说明，单机、分布式、集群通用

|  
|分类一|分类二|测试点|预期|备注|
|---|---|---|---|---|---|
|1|冒烟|  
|可以开启流式fetch|开启流式fetch生效|  
|
|2|  
|  
|有设置超时的能力|设置超时生效|  
|
|3|  
|  
|大数据量的场景下流式fetch性能|优于一应一答的fetch|  
|
|4|  
|  
|  
|  
|  
|
|5|接口测试|stmt.enableStreamResultSet()|打开流式fetch|开启流式fetch|  
|
|6|  
|stmt.disableStreamResultSet()|关闭流式fetch|关闭流式fetch|  
|
|7|  
|stmt.setFetchSize()|Integer  .  MIN_VALUE|开启流式fetch|  
|
|8|  
|  
|设为其他大于0的值|关闭流式fetch|  
|
|9|  
|  
|设为其他|报错|  
|
|10|  
|stmt.getFetchSize()|验证设置  Integer  .  MIN_VALUE|符合预期|  
|
|11|配置|客户端streamingResultNetTimeout|验证超时时间设置|超时合理报错|  
|
|12|  
|  
|验证超时时间设置优先级高于服务端|超时时间以客户端为主|  
|
|13|  
|  
|多个连接设置不同超时时间|验证客户端配置超时的独立性|  
|
|14|  
|  
|验证参数设置非法|合理报错|  
|
|15|  
|服务端  PACKET_SEND_TIMEOUT|yasdb.ini设置|超时时间符合预期|单机|
|16|  
|  
|alter sesion|  
|  
|
|17|  
|  
|toml文件设置|超时时间符合预期|分布式、集群|
|18|  
|  
|验证超时默认值|默认600s|  
|
|19|  
|  
|  
|  
|  
|
|20|性能|  
|Yashan大数据量场景下fetch性能|优于一应一答的fetch|  
|
|21|  
|  
|Oracle大数据量场景下fetch性能|与yashan比较|  
|
|22|  
|  
|clickhouse大数据量场景下fetch性能|与yashan比较|  
|
|23|  
|  
|读写并发场景下的性能|与之前版本比较|  
|
|24|  
|  
|读读并发场景下的性能|与之前版本比较|  
|
|25|  
|  
|  
|  
|  
|
|26|功能|stmt.executeQuery(String sql)|resultset next完，关闭resultset。再使用对应stmt查询|查询成功|  
|
|27|  
|  
|resultset没有next完，直接关闭resultset。再使用对应stmt查询|查询成功|  
|
|28|  
|  
|resultset next完，未关闭resultset。再使用对应stmt查询|查询成功|  
|
|29|  
|  
|resultset没有next完，未关闭resultset。再使用对应stmt查询|合理报错|  
|
|30|  
|  
|  
|  
|  
|
|31|  
|stmt.execute+stmt.getResultSet() 验证prefetch|resultset next完，关闭resultset。再使用对应stmt查询|查询成功|新建statement查询|
|32|  
|  
|resultset没有next完，直接关闭resultset。再使用对应stmt查询|查询成功|  
|
|33|  
|  
|resultset next完，未关闭resultset。再使用对应stmt查询|查询成功|  
|
|34|  
|  
|resultset没有next完，未关闭resultset。再使用对应stmt查询|合理报错|  
|
|35|  
|  
|  
|  
|  
|
|36|  
|stmt.getMoreResults()+stmt.getResultSet() 返回多结果集，流式fetch|resultset next完，关闭resultset。再切换到下一个resultset |当前resultset 可以fetch|不生效|
|37|  
|  
|resultset没有next完，直接关闭resultset。再切换到下一个resultset|当前resultset 可以fetch|  
|
|38|  
|  
|resultset next完，未关闭resultset。再切换到下一个resultset|当前resultset 可以fetch|  
|
|39|  
|  
|resultset没有next完，未关闭resultset。再切换到下一个resultset|当前resultset 可以fetch？|  
|
|40|  
|  
|只读取其中几个resultset，resultset 未fetch完；再使用对应stmt查询|当前resultset 可以fetch？|  
|
|41|  
|  
|只读取其中几个resultset，resultset fetch完；再使用对应stmt查询|当前resultset 可以fetch？|  
|
|42|  
|  
|多个resultsets全部fetch完，再使用对应stmt查询|当前resultset 可以fetch|  
|
|43|  
|  
|  
|  
|  
|
|44|  
|stmt.getGeneratedKeys()返回resultset|resultset next完，关闭resultset。再使用对应stmt查询|查询成功|  
|
|45|  
|  
|resultset没有next完，直接关闭resultset。再使用对应stmt查询|查询成功|  
|
|46|  
|  
|resultset next完，未关闭resultset。再使用对应stmt查询|查询成功|  
|
|47|  
|  
|resultset没有next完，未关闭resultset。再使用对应stmt查询|合理报错|  
|
|48|  
|  
|  
|  
|  
|
|49|  
|preparestatement.executeQuery()|resultset next完，关闭resultset。再使用对应pstmt查询|查询成功|查询中使用绑定参数，结果集返回多行，使用|
|50|  
|  
|resultset没有next完，直接关闭resultset。再使用对应pstmt查询|查询成功|  
|
|51|  
|  
|resultset next完，未关闭resultset。再使用对应pstmt查询|查询成功|  
|
|52|  
|  
|resultset没有next完，未关闭resultset。再使用对应pstmt查询|合理报错|  
|
|53|  
|  
|  
|  
|  
|
|54|  
|ResultSet|resultSetType=TYPE_FORWARD_ONLY|查询成功|  
|
|55|  
|  
|resultSetType=TYPE_SCROLL_INSENSITIVE|合理报错?|  
|
|56|  
|  
|resultSetType=TYPE_SCROLL_SENSITIVE|合理报错?|  
|
|57|  
|  
|resultSetConcurrency=CONCUR_READ_ONLY|查询成功|  
|
|58|  
|  
|resultSetConcurrency=CONCUR_UPDATABLE|合理报错?|  
|
|59|  
|  
|  
|  
|  
|
|60|  
|单机主备|连接备机查询，流式fetch|查询成功|  
|
|61|  
|  
|  
|  
|  
|
|62|并发|读读并发|同个conn 2并发查询，俩个stmt|一个查询成功，另一个失败|  
|
|63|  
|  
|同个conn 一个打开，一个关闭查询|一个查询成功，另一个失败或两个成功|分情况|
|64|  
|  
|不同conn并发查询|均可成功|  
|
|65|  
|读写并发|同个conn 一个stmt插入，一个stmt查询，一个表并发|失败|同61|
|66|  
|  
|不同conn插入查询一个表并发|成功|  
|
|67|  
|  
|  
|  
|  
|
|68|兼容性|  
|23.2客户端跑22.2、23.1服务端|流式的用例合理报错|  
|
|69|  
|  
|22.2、23.1客户端跑23.2服务端|流式的用例无法编译|  
|
|70|资料用例|  
|验证资料用例|文档无误|  
|


  


# 5.   **测试用例**

[YDBRD-22288【协议】fetch接口支持流式测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWRhMWFkOWEzMzExZGM4NGJiIiwicmVmX2lkIjoiNjczOTZiYWQ1OTNmOTljOWZmMjM2NWI0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MjQ2LCJleHAiOjE3ODIzODI2NDZ9.sfKvyuCR9wuB08pdeRNk5aY8m-SDruXjwHuehBFxAqI)

# 6.   **测试框架设计**

testng

# 7.   **测试环境说明**

|IP|内存|磁盘空间|磁盘类型|CPU|操作系统|
|:---|:---|:---|:---|:---|:---|
|192.168.6.153|32G|700G|SSD|8核|centos7.0|
|192.168.6.155|32G|900G|SSD|8核|centos7.0|


## Attachments:

[YDBRD-22288【协议】fetch接口支持流式测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWRhMWFkOWEzMzExZGM4NGJiIiwicmVmX2lkIjoiNjczOTZiYWQ1OTNmOTljOWZmMjM2NWI0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MjQ2LCJleHAiOjE3ODIzODI2NDZ9.sfKvyuCR9wuB08pdeRNk5aY8m-SDruXjwHuehBFxAqI)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
