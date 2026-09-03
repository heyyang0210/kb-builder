Created by 侯忠林, last modified on 六月 27, 2023

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

TAF全称Transparent Application Failover，驱动的透明应用故障转移功能，使你能够在连接的数据库实例发生故障时自动重新连接到数据库。新的数据库连接，虽然是由不同的节点创建的，但与原来的连接是相同的。在重新连接过程中，之前的活动事务将会被回滚，但在“具体条件”下TAF可以保证SELECT语句不被终止。这也是RAC亮点之一。所谓的“具体条件”指的就是FAILOVER_MODE中METHOD选择“BASIC”、TYPE选择“SELECT”。

透明应用故障转移（TAF）是Java数据库连接（JDBC）驱动程序的一个功能（Oracle是JDBC调用OCI接口实现）。如果连接的数据库实例失败，它使应用程序能够自动重新连接到数据库。在这种情况下，活动的事务会回滚。

当一个建立连接的实例失败或关闭时，客户端的连接会变得陈旧，并会向试图使用它的调用者抛出异常。TAF使应用程序能够透明地重新连接到一个预先配置的二级实例，创建一个新的连接，但与第一个原始实例上建立的连接相同。也就是说，连接的属性与早期连接的属性相同。无论连接是如何丢失的，这都是真的。

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1：TAF是客户端提供的一项特性，使用TAF，对客户端的环境有一定的要求，目前和服务端没有任何关系；

2：大致上TAF可以分为2种，连接时的TAF和会话建立后TAF，BASIC和PRECONNECT两个可选值；

3：TAF本身与是否RAC环境无关，但一般都用在RAC环境，最小程度的减少最应用的影响，单实例环境下也可以使用TAF，表现为，即使数据库实例重启，也不需要重新连接；

4：TAF模式可触发回调函数，函数由崖山定义，客户实现，在TAF触发时在不同的阶段触发回调函数

5：回调函数能够触发的事件总计7中，不同的事件在不同的阶段触发。

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

|类|接口|参数|说明|
|---|---|---|---|
|YasConnection|public void registerTAFCallback(YasFailover yasFailover , Object ctxt)|yasFailover: 用户注册实callbackFn 方法的实体类,ctxt：  用户想要保存的任何对象|注册TAF回调函数的实现类|
|YasFailover|public int callbackFn (Connection conn, Object ctxt,  int type,  int event )|conn： 当前的链接,ctxt： 用户想要保存的任何对象,type：故障转移类型,event： 故障转移事件|TAF的回调函数,如果注册了回调函数则failoverRetries和failoverDelay 不生效。|


```
public interface YasFailover{

// Possible Failover Types
public static final int FO_SESSION = 1;
public static final int FO_SELECT  = 2;
public static final int FO_NONE  = 3;
public static final int;

// Possiruguble Failover events registered with callback
public static final int FO_BEGIN   = 1;
public static final int FO_END     = 2;
public static final int FO_ABORT   = 3;
public static final int FO_REAUTH  = 4;
public static final int FO_ERROR  = 5;
public static final int FO_RETRY  = 6;
public static final int FO_EVENT_UNKNOWN = 7;

public int callbackFn (Connection conn,
                       Object ctxt, // ANy thing the user wants to save
                       int type, // One of the possible Failover Types
                       int event ); // One of the possible Failover Events
}
```

  


  [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

1. TAF的模式目前只实现BASIC一中模式。
1. TAF的类型目前只实现SESSION一种模式,不实现SELECT。
1. TAF的事件类型目前实现BEGIN，END，ERROR.三种。
1. TAF机制不支持LOB。


##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

### 1. TAF相关的配置

JDBC配置：

**URL=jdbc:yasdb://[host][:port]/[database]?[propertyName1=propertyValue1] & [propertyName2]=propertyValue2]**

新增参数  **failover,failoverType,failoverMethod,failoverRetries,failoverDelay 不区分大小写，参数也不区分大小写**  。

示例：

oracle示例：

String url="jdbc:oracle:oci:@(DESCRIPTION =(ADDRESS_LIST=(ADDRESS = (PROTOCOL = TCP)(HOST = 192.168.3.104)(PORT = 1521))(ADDRESS = (PROTOCOL = TCP)(HOST = 192.168.3.109)(PORT = 1521)))"    
                   + "(LOAD_BALANCE = yes)(  **FAILOVER = ON**  )(CONNECT_DATA =(SERVER = DEDICATED)(SERVICE_NAME = RACDB)"    
                   + "(  **FAILOVER_MODE=(TYPE = SESSION)(METHOD = BASIC)(RETRiES = 180)(DELAY = 100))**  ))";

崖山示例：

String url="jdbc:    [yasdb://192.168.1.1:1688/yashan?failover=on&failoverType=basic&failoverMethod=session&failoverRetries=2](yasdb://192.168.1.1:1688/yashan?connecTimeout=60&socketTimeout=120&loginTimeout=60&serverMode=dedicated)    0    [&failoverDelay =1](yasdb://192.168.1.1:1688/yashan?connecTimeout=60&socketTimeout=120&loginTimeout=60&serverMode=dedicated)    5";

failover：是否开启故障转移，默认OFF。(failover的开关只代表故障转移的时候节点是否需要顺延，如果是OFF则标识只重连当前断掉的链接，目前暂时不支持)

failoverType    TAF的类型，NONE，SESSION，SELECT三种类型，默认NONE，目前不支持SELECT

failoverMethod：TAF模式，由BASIC和PRECONNECT两个可选值，目前只支持BASIC,默认BASIC

failoverRetries: 重试次数，默认5次

failoverDelay : 重试间隔时间，单位秒，默认1秒

在高可用主备或者负载均衡模式下同样支持：

主备：jdbc:yasdb:    [primary://192.168.1.1:1688,192.168.1.2:1688,192.168.1.3:1688/yashan?](primary://192.168.1.1:1688,192.168.1.2:1688,192.168.1.3:1688)      [failover=on&failoverType=basic&failoverMethod=session&failoverRetries=2](yasdb://192.168.1.1:1688/yashan?connecTimeout=60&socketTimeout=120&loginTimeout=60&serverMode=dedicated)      [0](primary://192.168.1.1:1688,192.168.1.2:1688,192.168.1.3:1688)      [&failoverDelay =1](yasdb://192.168.1.1:1688/yashan?connecTimeout=60&socketTimeout=120&loginTimeout=60&serverMode=dedicated)      [5](primary://192.168.1.1:1688,192.168.1.2:1688,192.168.1.3:1688)  

负载均衡：jdbc:yasdb:    [loadBalance://192.168.1.1:1688,192.168.1.2:1688,192.168.1.3:1688/yashan](loadBalance://192.168.1.1:1688,192.168.1.2:1688,192.168.1.3:1688)    ?    [failover=on&failoverType=basic&failoverMethod=session&failoverRetries=2](yasdb://192.168.1.1:1688/yashan?connecTimeout=60&socketTimeout=120&loginTimeout=60&serverMode=dedicated)    0    [&failoverDelay =1](yasdb://192.168.1.1:1688/yashan?connecTimeout=60&socketTimeout=120&loginTimeout=60&serverMode=dedicated)    5

### 2. TAF的场景

**TAF触发条件**  ：网络中断，服务端实例关闭。

**TAF触发时间**  ：故障转移的节点在conn重新和服务端交互的时候，如果链接不通，则故障转移，如果不交互则不触发TAF。

**回调函数的触发**  ：回调函数是在故障转移开始时就触发，转移的不同阶段触发多次（开始异常结束等），不同的阶段触发不同的事件。例如一个成功的TAF会触发两次回调函数，BEGIN和END。异常的则触发BEGIN和ERROR两个事件。

**SELECT和SESSION的区别**  ：SELECT级别的会在当前查询返回结果。SESSION级别在当前查询下抛出异常：无法安全重放调用，下一个查询正常使用。

**不支持的机制**  ：SESSION和SELECT级别，如果是TAF不支持的lob，触发的服务端交互中发生TAF，现象相同在TAF过程中报异常：java.sql.SQLException: 无法安全重放调用。

                         如果在TAF之后conn可用，在调用lob，tempLob服务端提示不存在的临时lob，knlLob依然可用，但是如果knllob开启了事务则提示：事务处理必须重新运行。驱动不处理，服务端是报错lob失效。

**PRECONNECT模式和BASIC模式：**  PRECONNECT模式如果开始备用的链接不可达，会退化成basic模式在TAF触发时重连。

**TAF之后的CONN资源**  ：TAF之后的conn继承原来conn的属性，包括  stament也是直接可用的,preparedStatement在prepared以后依然可以直接执行。SELECT级别还可以在触发TAF异常的语句中直接拿到执行结果。事务隔离级别和自动提交属性保留。

**事务**  ：如果原来的conn开启了事务没有提交，在TAF链接回复之后，使用链接的时候报错：事务处理必须重新运行，如果直接commit提交事务提示异常：事务处理状态不明。原来的事务回滚。只有执行了rollback才能继续使用。

**TAF触发次数**  ：TAF只触发一次，如果在一个完成TAF过程中重连失败则关闭此链接，后续不会在触发TAF。

#### 单机模式

1. 回调函数的的类需要在开始的时候注册registerTAFCallback，否则无法调用回调函数,回调函数异常时，抛出异常，但是链接还是正常可用的，但是SELECT模式下sql无法正常返回值。    
  2.单节点的故障转移不能成功重连，抛出异常：连接失去联系，后续链接也不可使用。重连成功后续链接继续可以正常使用。

#### 多节点模式

如果有两个以上的节点，如果第二个节点无法链接，一直继续调用下面的链接，直到能链接上。

### 3. 心跳检测

原来的方案：每一个ip+端口表示一个数据库，使用同一个心跳检测机制.每个心跳检测创建一个daemonConnection，定时发送select 1 from dual语句检测保活。

现在方案： 每一个ip+端口表示一个数据库，使用同一个心跳检测机制，心跳检测采用CMD +ping+报文的形式定点向服务端发送检测，服务端接收到报文以后直接返回ack报文。

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1.配置参数能够正常使用获取到正确配置

2.单节点模式下能够正常触发TAF

3.多节点模式下能够正常触发TAF，并且能够实现节点往下顺延的功能

4.TAF失败是异常，成功时的一样不一样，并且接下来的sql正常执行

5.TAF不支持的lob在不同节点的异常报错

6.心跳检测模式正常，能够关闭异常的链接，也不会错误关闭正常链接。

7.在有事务的时候，TAF之后conn依然不可用提示：事务处理必须重新运行

8.回调函数功能使用正常

##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量（人天）。*

代码1000+行，工作量10天。

##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

1.实现PRECONNECT模式

2.实现支持SELECT模式