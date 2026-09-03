Created by 郑思远, last modified on 六月 13, 2023

# 1.   **概述**

本文描述JDBC支持Transparent Application Failover(TAF)接口。

TAF，透明应用故障转移功能是在连接的数据库实例发生故障时自动重新连接到数据库。

# 2.   **需求分析**

  [YDBRD-13081](https://jira.yasdb.com/browse/YDBRD-13081?src=confmacro)    **-**  **【驱动】JDBC支持TAF接口**  **完成**

设计文档  **：**    [Transparent Application Failover - 侯忠林 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/~houzhonglin/Transparent+Application+Failover)  

1） url示例：

String url="jdbc:oracle:oci:@(DESCRIPTION =(ADDRESS_LIST=(ADDRESS = (PROTOCOL = TCP)(HOST = 192.168.3.104)(PORT = 1521))(ADDRESS = (PROTOCOL = TCP)(HOST = 192.168.3.109)(PORT = 1521)))"    
                   + "(LOAD_BALANCE = yes)(  **FAILOVER = ON**  )(CONNECT_DATA =(SERVER = DEDICATED)(SERVICE_NAME = RACDB)"    
                   + "(  **FAILOVER_MODE=(TYPE = SESSION)(METHOD = BASIC)(RETIRES = 180)(DELAY = 100))**  ))";

  


2）特性涉及的参数如下：

|参数|值|释义|备注|
|---|---|---|---|
|**FAILOVER**  ** **|**ON**|**FAILOVER**  ** 打开**|  
|
|  
|OFF|**FAILOVER**  ** 关闭**|  
|
|**TYPE**|SELECT（不支持）|表示在故障切换发生后，新的连接会被创建到正常实例，问题出现时正在运行的SELECT语句会被继续执行，在新的节点上继续返回后续结果集，而已经返回的记录集则抛弃。|  
|
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
|在失败之前尝试故障切换的次数。|异常值|
|**DELAY**  ** **|  
|每次切换的时间间隔。|异常值|


  


3）特性涉及回调函数，用来打印故障时用户自定义的、和Failover相关的信息

回调函数是在故障转移开始时就触发，转移的不同阶段触发多次（开始异常结束等），不同的阶段触发不同的事件。例如一个成功的TAF会触发两次回调函数，BEGIN和END。异常的则触发BEGIN和ERROR两个事件。

|类|接口|参数|说明|备注|
|---|---|---|---|---|
|YasConnection|public void registerTAFCallback(YasFailover yasFailover , Object ctxt)|yasFailover: 用户注册实callbackFn 方法的实体类,ctxt：  用户想要保存的任何对象|注册TAF回调函数的实现类|  
|
|YasFailover|public int callbackFn (Connection conn, Object ctxt,  int type,  int event )|conn： 当前的链接,ctxt： 用户想要保存的任何对象,type：故障转移类型,event： 故障转移事件|TAF的回调函数|事件类型目前实现BEGIN，END，ERROR.三种；,不支持FO_ABORT、,FO_REAUTH    、,FO_RETRY    、,FO_EVENT_UNKNOWN |


功能限制

1. TAF的模式目前只实现BASIC一中模式。
1. TAF的类型目前只实现SESSION一种模式,不实现SELECT。
1. TAF的事件类型目前实现BEGIN，END，ERROR.三种。
1. TAF机制不支持LOB(select级别下)。


# 3.   **测试设计方法**

1.测试故障后连接是否成功

2.测试重连前后连接属性

3.事务

4.故障场景

5.测试集群（3实例部署）、分布式（1mn2cn2dn部署）、单机、单机主备

  


# 4.   **详细测试设计**

1.测试连接参数

|  
|参数|值|预期|备注|
|---|---|---|---|---|
|1|**FAILOVER**  ** **|**ON**|**FAILOVER**  ** 打开**|  
|
|2|  
|OFF|**FAILOVER**  ** 关闭**|  
|
|3|**TYPE**|SELECT（不支持）|合理报错|  
|
|4|  
|SESSION|表示在故障切换发生后，新的连接会被创建到正常实例，问题出现时正在运行的操作不会被继续执行。|  
|
|5|  
|NONE|禁用TAF|  
|
|6|** METHOD **|BASIC|表示数据库会在故障切换时在目标实例中创建会话。|  
|
|7|  
|PRECONNECT（不支持）|合理报错|  
|
|8|**RETIRES**  ** **|  
|在失败之前尝试故障切换的次数。|异常值|
|9|**DELAY**  ** **|  
|每次切换的时间间隔。|异常值|


  


2.测试回调函数

public void registerTAFCallback(YasFailover yasFailover , Object ctxt)

public int callbackFn (Connection conn, Object ctxt,  int type,  int event )

  


3.验证重连前后的连接属性

|序号|属性|备注|
|---|---|---|
|1|conn.getAutoCommit()|  
|
|2|conn.getTransactionIsolation()|  
|
|3|conn.getCatalog()|  
|
|4|conn.getHoldability()|  
|
|5|conn.getSchema()|  
|
|6|conn.getNetworkTimeout()|  
|
|7|conn.getTypeMap()|  
|
|8|conn.prepareStatement()|  
|
|9|conn.createStatement()|  
|
|10|conn.getMetaData()|  
|


  


4.验证重连前后的dml

|序号|dml|预期|备注|
|---|---|---|---|
|1|insert、update、delete|执行中断连，事务回滚|  
|
|2|select|执行中断连，SESSION模式下，查询结果为null，抛出异常|  
|


  


5.故障场景

|序号|故障场景|分类一|分类二|预期|备注|
|---|---|---|---|---|---|
|1|连接后实例故障|单实例故障|一个或多个连接断连|与新的实例建立新的连接|  
|
|2|  
|  
|开启taf和未开启taf的连接混用|  
|  
|
|3|  
|多实例故障|多个实例同时，多个连接断连|与新的未故障实例建立新的连接|  
|
|4|  
|  
|实例一故障，连接转移实例二；实例二再发生故障|与实例三建立新的连接|  
|
|5|  
|  
|实例一故障；故障恢复后，构造其他实例故障场景使连接转移回实例一|  
|目前集群连续故障后yasboot重启有问题，暂时没测|
|6|  
|  
|全部故障|连接重试超时后抛出异常|重试一次遍历所有节点，包括故障节点|
|7|连接后实例故障但不产生交互|  
|  
|不触发taf|  
|
|8|测试执行回调函数时实例失败|  
|  
|  
|  
|
|9|并发连不同实例故障|  
|  
|  
|  
|
|10|单机、分布式事务工程使用taf|  
|  
|  
|  
|


  


6.故障模式

1.断电、拔网线、网口不通

2.服务端shutdown

  


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

1. 单机 yasdb_jdbc
1. 分布式dp_yasdb_jdbc
1. 集群暂无工程，添加


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

## Comments:

|  [](null)  ,代码是否涉及服务端？,Posted by zhengsiyuan at 五月 31, 2023 09:54|
|---|
|  [](null)  ,RAC环境下，是否可以把TAF配置在服务,Posted by zhengsiyuan at 五月 31, 2023 15:22|
