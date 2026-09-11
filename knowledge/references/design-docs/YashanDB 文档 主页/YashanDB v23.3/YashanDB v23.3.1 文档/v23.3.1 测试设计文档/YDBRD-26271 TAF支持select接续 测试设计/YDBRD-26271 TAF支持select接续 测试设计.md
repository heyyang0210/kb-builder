Created by 李潮 on 六月 24, 2024

# 1. 概述

taf增加FAILOVER_MODE=SELECT功能，在进行节点发生故障时，客户端进行重连并保持查询操作不中断。

SR:     [https://pingcode.yasdb.com/pjm/items/6618e5e6fd997db58ad82892](https://pingcode.yasdb.com/pjm/items/6618e5e6fd997db58ad82892)    ?    
  #YDBRD-26271 【JDBC】TAF支持select接续

oracle:     [Transparent Application Failover (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/12.2/jjdbc/transparent-application-failover.html#GUID-0C2A0B68-6391-4CDD-A5D0-3A7B72966E79)  

开发文档：    [JDBC支持TAF select模式 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=147779970)  

参考：

  [Transparent Application Failover - 侯忠林 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/~houzhonglin/Transparent+Application+Failover)  

  [YDBRD-13081 JDBC支持TAF接口 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=112724197)  

  


# 2.需求分析

  


1） url示例：

String url="jdbc:oracle:oci:@(DESCRIPTION =(ADDRESS_LIST=(ADDRESS = (PROTOCOL = TCP)(HOST = 192.168.3.104)(PORT = 1521))(ADDRESS = (PROTOCOL = TCP)(HOST = 192.168.3.109)(PORT = 1521)))"    
                   + "(LOAD_BALANCE = yes)(  **FAILOVER = ON**  )(CONNECT_DATA =(SERVER = DEDICATED)(SERVICE_NAME = RACDB)"    
                   + "(  **FAILOVER_MODE=(TYPE = SELECT)(METHOD = BASIC)(RETIRES = 180)(DELAY = 100))**  ))";

  


2）特性涉及的参数如下：

|参数|值|释义|备注|
|:---|:---|:---|:---|
|**FAILOVER**  ** **|**ON**|**FAILOVER**  ** 打开**|  
|
|  
|OFF|**FAILOVER**  ** 关闭**|  
|
|**TYPE**|SELECT|表示在故障切换发生后，新的连接会被创建到正常实例，问题出现时正在运行的SELECT语句会被继续执行，在新的节点上继续返回后续结果集，而已经返回的记录集则抛弃。|新增功能|
|  
|SESSION|表示在故障切换发生后，新的连接会被创建到正常实例，问题出现时正在运行的操作不会被继续执行。|  
|
|  
|NONE|表示不会发生故障切换，即禁用TAF|  
|
|** METHOD **|BASIC|表示数据库会在故障切换时在目标实例中创建会话。|  
|
|  
|PRECONNECT（不支持）|表示数据库会在最初建立连接时就同时建立到所有实例的连接，当发生故障时就可以立刻切换到其它链路上，这会对目标实例产生额外的工作负载。|  
|
|**RETIRES**  ** **|  
|在失败之前尝试故障切换的次数。|  
|
|**DELAY**  ** **|  
|每次切换的时间间隔。|  
|


3）特性涉及回调函数，用来打印故障时用户自定义的、和Failover相关的信息

回调函数是在故障转移开始时就触发，转移的不同阶段触发多次（开始异常结束等），不同的阶段触发不同的事件。例如一个成功的TAF会触发两次回调函数，BEGIN和END。异常的则触发BEGIN和ERROR两个事件。

|类|接口|参数|说明|备注|
|:---|:---|:---|:---|:---|
|YasConnection|public void registerTAFCallback(YasFailover yasFailover , Object ctxt)|yasFailover: 用户注册实callbackFn 方法的实体类,ctxt：  用户想要保存的任何对象|注册TAF回调函数的实现类|  
|
|YasFailover|public int callbackFn (Connection conn, Object ctxt,  int type,  int event )|conn： 当前的链接,ctxt： 用户想要保存的任何对象,**type：故障转移类型**,event： 故障转移事件|TAF的回调函数|支持FO_BEGIN、FO_ERROR、FO_RETRY、FO_END，在FO_ERROR事件中如果返回FO_RETRY则表示再尝试进行一次连接。,不支持FO_ABORT、  FO_REAUTH    、  FO_EVENT_UNKNOWN |


功能限制

1. TAF的模式目前只实现BASIC一中模式。
1. TAF的事件类型目前实现BEGIN，END，ERROR，RETRY四种。


# 3.测试设计方法

1.测试故障后连接是否成功

2.测试重连前后连接属性

3.事务

4.故障场景

5.测试集群（2实例部署）、分布式（1mn2cn2dn部署）、单机主备

  


# 4.详细测试方法

1.测试连接参数

|参数|值|预期|
|:---|:---|:---|
|**TYPE**|**SELECT**|表示在故障切换发生后，新的连接会被创建到正常实例，问题出现时正在运行的dql操作会被继续执行，其他操作不执行。|
|  
|~~SESSION~~|  
|
|  
|~~NONE~~|  
|
|**FAILOVER**|ON|FAILOVER 打开|
|  
|OFF|FAILOVER 关闭|
|~~**METHOD **~~|~~BASIC~~|~~表示数据库会在故障切换时在目标实例中创建会话。~~|
|  
|~~PRECONNECT（不支持）~~|~~合理报错~~|
|~~**RETIRES **~~|  
|~~在失败之前尝试故障切换的次数。~~|
|~~**DELAY **~~|  
|~~每次切换的时间间隔。~~|


2.测试回调函数

public void registerTAFCallback(YasFailover yasFailover , Object ctxt)

public int callbackFn (Connection conn, Object ctxt,  int type,  int event )

3.测试重连前后的连接属性

|序号|属性|
|:---|:---|
|1|conn.getAutoCommit()|
|2|conn.getTransactionIsolation()|
|3|conn.getCatalog()|
|4|conn.getHoldability()|
|5|conn.getSchema()|
|6|conn.getNetworkTimeout()|
|7|conn.getTypeMap()|
|8|conn.prepareStatement()|
|9|conn.createStatement()|
|10|conn.getMetaData()|


4.测试重连前后的dql,dml场景

|序号|操作|分类一|分类二|预期|oracle|
|:---|:---|:---|:---|:---|:---|
|1|insert、update、delete|prepare/statement|1.  ~~createStatement/Preparestatement前~~,2.excute 前,3.excute后，但未提交事务,4.  可更新结果集+update,  
|执行中断连，事务回滚|  
|
|2|select|prepare|1.有参,2.无参,3.大数据量参数,4.select列带lob参数,5.filter 带temp lob参数–不支持,6.开启  clientPrepare功能|执行中断连，SELECT模式下，重新获取查询结果|  
|
|  
|  
|statement|1.长sql,2.普通sql|执行中断连，SELECT模式下，重新获取查询结果|  
|
|  
|  
|DatabaseMetaData|1.任意查询，例如getUDTs|执行中断连，SELECT模式下，重新获取查询结果------发生断连，需要对比oracle|testDatabaseMetaData,![](https://pingcode.yasdb.com/atlas/files/public/67396e638970c2af4f521886/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWtBQUFBQUNDQUFBQUFBQUFBQUFBQ0NFQUFBQUFBQUNBQUFBQUFBZ1FBQUVBZ0dBQUFBQUFBQUFBQUFBSUFBQUFBUUFnSUFBQUFBQUFBQUFBQUFBQUFBWUFBQUFBQUFBQUFBQUVRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQWdBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE3MjYsImV4cCI6MTc4MjM4MjUyNn0.kgAYfSgLyCQmjZf0JWg2C6Lc3Pc_J1D7l8cuKe5JVZE)|
|3|fetch|resultset|1.需要多次fetch时，fetch第一次后发生故障,2.结果集带LOB,3.开启流式FETCH,4.fetch后发生故障，taf成功后继续事务操作,5.fetch lob列后发生故障，taf成功后继续对lob列事务操作--不支持|获取fetch结果|  
|
|  
|  
|ResultSetMetaData|1.任意查询|执行中断连，SELECT模式下，重新获取fetch结果|  
|
|  
|  
|滚动结果集,TYPE_SCROLL_INSENSITIVE,TYPE_SCROLL_SENSITIVE()|任意移动如下：,1.  beforeFirst/isBeforeFirst,2.  afterLast/isAfterLast,3.  first/isFirst,4.  last/isLast,5.  previous,6.  next,7.  relative,8.  absolute|执行中断连，SELECT模式下，重新获取fetch结果,------多stmt会结果集似乎互相会影响，与taf无关 --,testSrollResultSetINSENSITIVE2,![](https://pingcode.yasdb.com/atlas/files/public/67396e63a1ad9a3311dc96fa/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWtBQUFBQUNDQUFBQUFBQUFBQUFBQ0NFQUFBQUFBQUNBQUFBQUFBZ1FBQUVBZ0dBQUFBQUFBQUFBQUFBSUFBQUFBUUFnSUFBQUFBQUFBQUFBQUFBQUFBWUFBQUFBQUFBQUFBQUVRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQWdBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE3MjYsImV4cCI6MTc4MjM4MjUyNn0.kgAYfSgLyCQmjZf0JWg2C6Lc3Pc_J1D7l8cuKe5JVZE)|  
|
|  
|  
|可更新结果集,CONCUR_UPDATABLE|1.仅fetch,不进行更新|执行中断连，SELECT模式下，重新获取fetch结果|  
|
|4|并发场景下，多connection|包含上述|  
|  
|  
|


  


5.故障场景划分

|序号|部署模式|分类一|分类二|预期|备注|
|:---|:---|:---|:---|:---|:---|
|1|单机主备/分布式/集群|单实例/多实例故障|单节点故障，一个或多个连接断连|与新的主节点建立新的连接|  
|
|  
|  
|  
|未开启taf,开启taf session和开启taf select混用|与新的主节点建立新的连接|  
|
|  
|  
|  
|多节点故障，连续故障不同节点/故障后恢复节点|与新的主节点建立新的连接|回调函数疑是被过多次调用，,testMultiNodeDown,![](https://pingcode.yasdb.com/atlas/files/public/67396e63a1ad9a3311dc96fb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWtBQUFBQUNDQUFBQUFBQUFBQUFBQ0NFQUFBQUFBQUNBQUFBQUFBZ1FBQUVBZ0dBQUFBQUFBQUFBQUFBSUFBQUFBUUFnSUFBQUFBQUFBQUFBQUFBQUFBWUFBQUFBQUFBQUFBQUVRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQWdBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE3MjYsImV4cCI6MTc4MjM4MjUyNn0.kgAYfSgLyCQmjZf0JWg2C6Lc3Pc_J1D7l8cuKe5JVZE),![](https://pingcode.yasdb.com/atlas/files/public/67396e638970c2af4f521887/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWtBQUFBQUNDQUFBQUFBQUFBQUFBQ0NFQUFBQUFBQUNBQUFBQUFBZ1FBQUVBZ0dBQUFBQUFBQUFBQUFBSUFBQUFBUUFnSUFBQUFBQUFBQUFBQUFBQUFBWUFBQUFBQUFBQUFBQUVRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQWdBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE3MjYsImV4cCI6MTc4MjM4MjUyNn0.kgAYfSgLyCQmjZf0JWg2C6Lc3Pc_J1D7l8cuKe5JVZE)|
|  
|  
|  
|全部节点故障|taf失败|  
|
|  
|  
|  
|故障后不进行交互|不触发taf|  
|
|  
|  
|回调函数中构建故障|回调函数中抛出异常，for_begin/for_end/for_error|  
|  
|


6.故障模式

|分类|备注|
|:---|:---|
|shutdwon|1.shutdown immediate 能够触发taf，但是当前查询会话会被关闭抛出异常,![](https://pingcode.yasdb.com/atlas/files/public/67396e638970c2af4f521888/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWtBQUFBQUNDQUFBQUFBQUFBQUFBQ0NFQUFBQUFBQUNBQUFBQUFBZ1FBQUVBZ0dBQUFBQUFBQUFBQUFBSUFBQUFBUUFnSUFBQUFBQUFBQUFBQUFBQUFBWUFBQUFBQUFBQUFBQUVRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQWdBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE3MjYsImV4cCI6MTc4MjM4MjUyNn0.kgAYfSgLyCQmjZf0JWg2C6Lc3Pc_J1D7l8cuKe5JVZE)|
|yasboot node stop|  
|
|kill -9|yasboot node stop -f|


# 5.用例

1.冒烟

   电子表格

2.文本

   电子表格

# 6.测试框架设计

jdbc驱动框架

# 7.测试环境说明

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

## Attachments: