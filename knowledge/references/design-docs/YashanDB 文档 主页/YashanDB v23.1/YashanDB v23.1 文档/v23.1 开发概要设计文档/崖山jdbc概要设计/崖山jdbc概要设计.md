#   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#1-%E6%80%BB%E8%BF%B0)  

  


JDBC是Java Database Connectivity的缩写，是标准的Java API，是一套客户端程序与数据库交互的规范。JDBC提供了一套通过Java操纵数据库的完整接口。

崖山的jdbc基于java语言开发，支持JDK1.8及以上版本，遵循jdbc4.3规范。

崖山的jdbc驱动一般是作为应用项目的一个三方件被引用的，  下图描述了JDBC驱动在应用中的位置，可以看出应用代码有三种途径可以调用jdbc：

- 355px直接通过业务代码调jdbc.(实际项目中很少，小于1%)
- 通过连接池调jdbc。(实际项目中很少，小于1%)
- 通过持久层框架调jdbc。(98%以上的场景)
- ![](https://pingcode.yasdb.com/atlas/files/public/6739b5efa1ad9a3311dd73a4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQWdFQUFBQUFBQUFBQUFBQUFBb0FBQUFRQUFBQUFDQUFEQUFBQkFBQUFBUUFBQUFBQUFBQUFnQWdBQUFBQUFBQUFBQVFBQUVBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQVFBQWdBQUFBQUFJSUFBQUFBQUFBQVFBQUFBQUFBQVFBRUFBSUFBQUFBQUFBQUFBQUJBQUFLQ0VnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYyNzAsImV4cCI6MTc4MjEzNzA3MH0.Fc_uBrOt_PXTowghWNOZxGubNkDKssuNT2FFPLYYIoA)


## 1.1需求来源

崖山数据库要能支持被Java项目的调用，需要开发崖山的jdbc驱动。其中主要包含两部分内容：

1、支持JDBC4.3规范。

2、对规范之外的一些崖山特有功能的支持。

## 1.2需求分析

崖山jdbc最重要的一块就是支持jdbc4.3规范，4.3规范里定义了jdbc里需要使用到的接口。

java.sql里面主要包括：

- 连接相关：
    - Driver ：jdbc的总入口，获取连接等最基本的操作都从这里入口。
    - Connection：所有数据库操作入口
- 语句执行：
    - Statement：执行语句对象
    - PreparedStatement：预编译的语句
    - CallableStatement：过程体语句
- 结果集：
    - Resultset:语句执行后的结果集
- 数据类型的对象模型：
    - lob类型：Clob\Blob\NClob
    - 时间日期相关：Date\Time\Timestamp
    - UDT相关：Struct，SQLData，Ref、Array、SQLInput、SQLOutput
    - 其它：SQLXML，RowId
- 异常处理相关 ：20个左右的sql异常类
- 元数据：
    - ParameterMetaData：参数元数据
    - ResultSetMetaData：结果集元数据
    - DatabaseMetaData：数据库元数据


javax里面和jdbc相关的有：

- 数据源与连接池：
    - DataSource：数据源，用来设置连接属性。
    - PooledConnection ：池化的连接，用来缓存真实连接。
    - ConnectionPoolDataSource：池化的数据源，用来获取池化连接
- 分布式事务相关：
    - XAConnection：支持分布式事务的连接
    - XADataSource：用来获取XAConnection
    - XAResource：分布式事务管理器。
- rowset相关：提供了一整套的JavaBeans与数据库映射的模型。这部分还未实现。


jdbc驱动必须实现以上接口用来满足jdbc4.3规范的要求，除此之外从实现或者需求角度出发，jdbc还必须要有以下模块：

- 日志打印
- 与服务端的通信
- 协议处理，编解码
- 心跳监控
- taf


所有的这些组合起来就是目前JDBC的主要模块，各模块之间的关系：

![image.png](https://pingcode.yasdb.com/atlas/files/public/678526c9a1ad9a3311de6841/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQWdFQUFBQUFBQUFBQUFBQUFBb0FBQUFRQUFBQUFDQUFEQUFBQkFBQUFBUUFBQUFBQUFBQUFnQWdBQUFBQUFBQUFBQVFBQUVBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQVFBQWdBQUFBQUFJSUFBQUFBQUFBQVFBQUFBQUFBQVFBRUFBSUFBQUFBQUFBQUFBQUJBQUFLQ0VnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYyNzAsImV4cCI6MTc4MjEzNzA3MH0.Fc_uBrOt_PXTowghWNOZxGubNkDKssuNT2FFPLYYIoA)

从功能角度有如下功能点：

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|易用性|与连接池或者持久层框架的兼容,与Oracle功能上对齐,所有实现都要符合jdbc 4.3规范|----|否|是|
|可修改性|----|----|NA|不涉及|
|兼容性|新老版本的兼容,  
|通过connectVersion的方式去控制新老版本的搭配兼容问题|NA|是|
|可维可测|  
|  
|  
|  
|
|功能|- 连接
    - 获取连接
    - 连接池
- 语句执行
    - 直接执行
    - 参数绑定执行
    - 过程体执行
    - 调试执行
- 结果集获取
    - 普通结果集
    - 可滚动结果集
    - 可更新结果集
    - fetch
- 数据类型支持  

    - 普通类型的编解码和类型转换
    - clob/blob的处理。
    - json类型的编解码和工具类
    - udt类型的处理
- 事务处理
- 元数据
    - ParameterMetaData
    - ResultSetMetaData
    - DatabaseMetaData
|按jdbc4.3里面定义的接口规范进行实现|是|是|
|安全|  
|----|NA|不涉及|
|性能|- stream协议
- 流式fetch
- statement缓存
|EXP并行|是|是|
|可用性|  
|----|NA|不涉及|
|可靠性|- taf
|----|NA|不涉及|
|周边配合|数据库服务端|----|NA|不涉及|


#   [2. ](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)  功能列表

崖山的jdbc支持4.3规范，要实现的主要模块和主要接口如下

|模块|功能|
|:---|:---|
|Connection|- 获取连接
- taf
- 事务处理
|
|语句执行|  
,- 直接执行
- 参数绑定执行
- 过程体执行
- 调试执行
|
|结果集处理|- 普通结果集
- 可滚动结果集
- 可更新结果集
- fetch
|
|数据类型支持|- 普通类型的编解码和类型转换
- clob/blob的处理。
- json类型的编解码和工具类
- udt类型的处理
|
|元数据|- ParameterMetaData
- ResultSetMetaData
- DatabaseMetaData
|


#   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

- 部署形态：支持单机/分布式/集群部署形态。


#   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)  

## 4.1 主要模块

从1.2章节的各模块之间关系可以看出，JDBC主要围绕  **连接，语句，结果集，数据处理**  这几大块展开，所以按这个模块划分来逐一展开。

## 4.2 连接

### 4.2.1 获取连接

目前支持两种方式获取连接：

- DriverManager.getConnection
- YasDataSource.getConnection


这两种连接方式最终都会调到yasDriver.connect(String url, Properties info)方法

connect的大概处理流程是

![](https://pingcode.yasdb.com/atlas/files/public/6739b5efa1ad9a3311dd73a6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQWdFQUFBQUFBQUFBQUFBQUFBb0FBQUFRQUFBQUFDQUFEQUFBQkFBQUFBUUFBQUFBQUFBQUFnQWdBQUFBQUFBQUFBQVFBQUVBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQVFBQWdBQUFBQUFJSUFBQUFBQUFBQVFBQUFBQUFBQVFBRUFBSUFBQUFBQUFBQUFBQUJBQUFLQ0VnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYyNzAsImV4cCI6MTc4MjEzNzA3MH0.Fc_uBrOt_PXTowghWNOZxGubNkDKssuNT2FFPLYYIoA)

### 4.2.2 连接池

JDBC里面还支持连接池，主要通过实现如下两个接口来给用户提供连接池相关功能。

- ConnectionPoolDataSource：用来获取PooledConnection
- PooledConnection ：缓存了一个真实连接供用户调用。


连接池的实现思想是创建连接池时先获取一个真实连接缓存起来，后面每次需要连接时从连接池里把这个真实连接包装一层返回回去。每次吐出去一个连接之后都要把之前吐出去的连接打上close标识。

除此之外连接池搞了一整套的监听器模式，支持用户自定义事件监听。

两类监听器：

- ConnectionEventListener
- StatementEventListener


每个监听器都对两个事件进行监听：关闭和发生异常。

用户在使用连接池时，当把自定义监听器添加到连接池之后，如果连接池里的连接被关闭，或者发生异常时，都可以按照业务逻辑去做出相应的处理。

  


### 4.2.3 心跳监控

JDBC为了防止网络已断连，但jdbc依然死等服务端返回导致卡死的问题，设计了一套心跳监控机制，具体机制为：

每一个ip/port一个后台连接专门用于心跳，每20秒与服务端进行一次心跳，如果心跳不正常就把连接强制关闭。

### 4.2.4 taf

TAF全称Transparent Application Failover，驱动的透明应用故障转移功能，使你能够在连接的数据库实例发生故障时自动重新连接到数据库。新的数据库连接，虽然是由不同的节点创建的，但与原来的连接是相同的。在重新连接过程中，之前的活动事务将会被回滚，并且当前的语句会被终止。

### 4.2.5 事务处理

jdbc事务处理也是在连接层面进行的，主要包含三部分：

- 基本的事务操作，commit、rollback等操作。
- 设置自动提交。
- 设置savePoint，支持带savePoint的commit、rollback操作


## 4.3 语句执行

根据场景的不同语句执行需要用到如下三种不同的语句对象，Statemment，  PreparedStatement  ，  CallableStatement

### 4.3.1 Statement

Statement是JDBC里面最基本的语句对象，是  prepareStatement，CallableStatement，DebugCallableStatement的父类，关于语句操作的所有公共方法都在Statement里面。

Statement用来处理不带参数的SQL语句，可以单条执行也可以批量执行。

单条执行用法：直接Statement.execute(String sql)

批量执行用法：Statement.addBatch(String sql),然后Statement.executeBatch().注意批量执行不支持查询语句。

### 4.3.2   PreparedStatement

PreparedStatement  是预编译SQL的语句对象，继承自Statement，用来执行带参数的SQL语句。

与Statement的区别在于：

- PreparedStatement  可以绑定参数然后执行，而Statement只能执行不带参数的SQL。
- PreparedStatement一般情况下执行SQL分两步，prepare，然后执行。而Statement都是直接执行，不需要prepare。


prepare+execute交互流程图

![](https://pingcode.yasdb.com/atlas/files/public/6739b5ef8970c2af4f52f552/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQWdFQUFBQUFBQUFBQUFBQUFBb0FBQUFRQUFBQUFDQUFEQUFBQkFBQUFBUUFBQUFBQUFBQUFnQWdBQUFBQUFBQUFBQVFBQUVBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQVFBQWdBQUFBQUFJSUFBQUFBQUFBQVFBQUFBQUFBQVFBRUFBSUFBQUFBQUFBQUFBQUJBQUFLQ0VnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYyNzAsImV4cCI6MTc4MjEzNzA3MH0.Fc_uBrOt_PXTowghWNOZxGubNkDKssuNT2FFPLYYIoA)

### 4.3.3 CallableStatement

CallableStatement是是执行sql存储过程的SQL的语句对象，继承自PreparedStatement。

与PreparedStatement的区别在于：

- CallableStatement不仅可以绑定参数，还可以绑定出参的类型，并且在执行完成之后获取出参。


## 4.4 Resultset

ResultSet 是JDBC语句执行之后返回的结果集对象，一些元数据接口，或者一些需要返回多行多列数据的接口经常也用ResultSet 来承载返回值  。

ResultSet有两个类型参数  ：resultsetType和resultsetConcurrency。

默认情况下resultsetType为TYPE_FORWARD_ONLY，resultsetConcurrency为CONCUR_READ_ONLY，普通结果集。

 resultsetType为TYPE_SCROLL_INSENSITIVE或TYPE_SCROLL_SENSITIVE则为可滚动结果集。

resultsetConcurrency为CONCUR_UPDATABLE则代表可更新结果集。

  


### 4.4.1   普通ResultSet   ：

普通ResultSet是最简单也最常用的一种结果集，在创建语句对象时如果没传resultset类型，或者类型传的是TYPE_FORWARD_ONLY，执行结束后拿到的结果集就是普通结果集。

特点：

1、只能获取数据，不能更新数据。

2、只能通过next()操作游标从前往后移动，一行一行取数据。

总的执行流程是：每一个查询语句执行结束之后，从服务端返回查询投影列的元数据信息和数据内容RawData，创建一个resultset对象，创建时会根据投影列类型获取每一列的一个Accesser。用户从resultset获取数据时，是用对应的Accesser把需要的那一列数据编码成需要的Java类型返回给用户；用户调用next移动游标到下一行时，如果RawData没读完就行号加1，如果读完了就再向服务端发起一次fetch请求，拿到后面的RawData数据，每一次fetch取到新的RawData后，原来的RawData都会被丢弃。

![](https://pingcode.yasdb.com/atlas/files/public/6739b5ef8970c2af4f52f553/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQWdFQUFBQUFBQUFBQUFBQUFBb0FBQUFRQUFBQUFDQUFEQUFBQkFBQUFBUUFBQUFBQUFBQUFnQWdBQUFBQUFBQUFBQVFBQUVBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQVFBQWdBQUFBQUFJSUFBQUFBQUFBQVFBQUFBQUFBQVFBRUFBSUFBQUFBQUFBQUFBQUJBQUFLQ0VnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYyNzAsImV4cCI6MTc4MjEzNzA3MH0.Fc_uBrOt_PXTowghWNOZxGubNkDKssuNT2FFPLYYIoA)

### 4.4.2 可滚动结果集

在创建语句对象时如果传的类型是  TYPE_SCROLL_INSENSITIVE或TYPE_SCROLL_SENSITIVE  ，执行结束后拿到的结果集就是可滚动结果集。

可滚动结果集与普通结果集不同，不仅可以调next()接口向后移动，还可以通过  first()，last()， previous()把游标移动到第一行，最后一行，前一行等。还可以absolute( int row )方法跳转到指定的行。

可滚动结果集又分为两种：对数据变化不敏感（类型为  TYPE_SCROLL_INSENSITIVE  ）和对数据变化敏感（类型为  TYPE_SCROLL_SENSITIVE  ）。

两者的区别是：

对数据变化不敏感的可滚动结果集是这样的，只进行跳转，不重新刷新结果集里面的RawData数据.

对数据变化敏感的可滚动结果集是这样的每次游标移动，都重新执行一遍原sql语句获取最新的查询结果，然后把游标移动到指定行。

比如对如下示意图，假如读到其中某行。

对于数据变化不敏感的可滚动结果集来讲：

- 从当前行跳转到第b行，只需要重新设置当前行号为b就可以了。
- 但是假如要跳转到第c行，则需要重复fetch，直至取到包含第c行的数据，然后把当前行号设置为c。
- 从当前跳转到第a行，则需要重新执行原SQL语句，重新fetch，直至取到包含第a行的数据，然后把当前行号设置为a。


对于数据变化敏感的可滚动结果集来讲：无论从当前行跳转到哪一行，都需要重新执行SQL,只有这样才能保证下次获取数据时取到最新的数据结果。

  


![](https://pingcode.yasdb.com/atlas/files/public/6739b5efa1ad9a3311dd73a7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQWdFQUFBQUFBQUFBQUFBQUFBb0FBQUFRQUFBQUFDQUFEQUFBQkFBQUFBUUFBQUFBQUFBQUFnQWdBQUFBQUFBQUFBQVFBQUVBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQVFBQWdBQUFBQUFJSUFBQUFBQUFBQVFBQUFBQUFBQVFBRUFBSUFBQUFBQUFBQUFBQUJBQUFLQ0VnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYyNzAsImV4cCI6MTc4MjEzNzA3MH0.Fc_uBrOt_PXTowghWNOZxGubNkDKssuNT2FFPLYYIoA)

### 4.4.3 可更新结果集

可更新结果集可以对结果集进行更新和插入动作。

**更新操作**

用法为：先调updateXXX（int index,value）接口对值进行设置，然后调  updateRow执行更新操作。

原理是：

- 调updateXXX接口时把数据的值，数据的类型全部缓存下来
- 然后在updateRow时，根据原SQL,拼出来一条update语句，其中使用rowid作为过滤条件，类似 这样update xxx set col_xx=?,col_xx=? where rowid = ?
- 对拼出来的update语句进行预编译，然后把缓存起来的数据值和类型绑定上去。
- 然后执行该语句。


**插入操作**

用法为：先调moveToInsertRow()切换成插入模式，然后调updateXXX（int index,value）接口对值进行设置，然后调insertRow执行插入操作。

原理与更新操作原理类型，不同点在于拼出的sql是insert into xxx (col_xx,col_xx) values(?,?),其它绑定和执行都是类似的。

## 4.5 数据类型支持

### 4.5.1 普通数据类型

对普通数据类型来说，jdbc对数据类型的支持主要体现在三个方面：

1. jdbc都是在参数绑定时，把Java对象的值按不同的数据类型编码成二进制bytes，传输给服务端。
1. 在做数据查询fetch时，把数据库传过来的bytes转化成Java的对象值返回给用户。
1. 在上面两个步骤中如果涉及类型不匹配，jdbc会对数据进行合理的类型转换。


其中上面第一点是通过设计了YasParameter抽象类，所有数据类型分别实现自己的Parameter类型，里面封装了参数的类型，方向，值，以及不同类型的值的写包编码方式。

第二点是设计了Accessor接口，所有类型分别实现自己的Accessor，不同类型的Accessor按各自约定好的的编码格式对服务端数据进行解析。Accessor提供所有类型的get接口，各自类型按需实现各自类型所支持的get接口进行返回。

### 4.5.2 lob类型

LOB分为二进制lob(Blob)和字符lob(Clob),崖山的JDBC中实现定义了YasBlob和YasClob类来对lob进行操作。

JDBC操作lob数据与其他数据类型的不同之处在于，在参数绑定执行或者fetch数据过程中，其它数据类型都传输的是数据本身，而lob数据传输的是lobLocator。

#### 参数绑定的lob操作流程：

- jdbc创建lob，拿到lobLocator。
- 使用lobLocator把lob真实数据传给服务端，在服务端暂存起来。
- 参数绑定执行时，只传lobLocator，服务端会根据lobLocator取到真实的lob数据来进行操作。


#### Fetch基本流程：

- 服务端传过来的是lobLocator,jdbc根据lobLocator组装出lob对象。
- 操作lob对象时，根据lobLocator从服务端取到真实的数据。


### 4.5.3 JSON类型

JSON是一种独立于编程语言的数据交换格式，采用文本格式来表述数据，Yashan的json支持十六种类型：Object\Array两种非标量类型，十四种标量类型。

Yashan的JDBC定义了以下三部分内容，通过这三部分的配合协作完成json数据的存取，以及json文本，JSON二进制存储格式，json对象这三者之间的来回转换。

- 与类型相对应的16个json类型的数据模型
- 事件流读取器和写入器
- 所有对象的创建工厂


|描述|类|
|---|---|
|JSON类型对象模型|YasonValue,YasonObject,YasonArray,YasonString,YasonDecimal,  
YasonBoolean,YasonNull,YasonByte,YasonShort,YasonInt,
YasonLong,YasonFloat,YasonDouble,YasonBinary
YasonDate,YasonTime,YasonTimestamp|
|JSON类型的事件流读取器和写入器|YasonGenerator, YasonParser|
|读取、写入和创建JSON类型值的工厂|YasonFactory|


#### Json数据的传输也是和其他数据类型不同的：

- 在进行参数绑定时，json数据会被编码成JSON的二进制存储格式，然后通过Stream协议去参数绑定。
- 在fetch时，服务端会把json数据转化成lob,驱动端通过lob的方式拿到所有的json二进制数据，然后再对二进制数据进行解码，得到JSON对象。


### 4.5.4 UDT类型

UDT是用户自定义类型，具体分为三类数据类型：OBJECT、VARRAY、NESTED TABLE

YashanDB JDBC驱动目前只支持UDT类型的查询功能。

默认情况下，通过JDBC查询出来的object类型会被映射成java的Struct类型，Varray与nested table映射成array类型。

此外，JDBC还支持UDT的Object类型与用户自定义类型的映射，通过正确的实现自定义类并且设置映射关系，就能把Object类型映射成自定义类。

## 4.6 元数据

jdbc还可以获取元数据，主要分成三种：

- ParameterMetaData
- ResultSetMetaData
- DatabaseMetaData


### 4.6.1 ParameterMetaData 

ParameterMetaData 是语句参数信息的元数据，是PreparedStatement在执行了服务端prepare之后，通过服务端的返回信息构建出来的，由于目前实现问题，其中大部分方法都还没实现。

### 4.6.2 ResultSetMetaData

ResultSetMetaData是结果集的元数据，是语句执行之后，由服务端把元数据信息和数据信息一起返回给jdbc，再由jdbc构建出来的。

### 4.6.2 DatabaseMetaData

### DatabaseMetaData是整个数据库的元数据信息，主要分为两类：

- 对数据库和驱动的固有属性或者语法的描述信息
- 数据库里各种对象的信息


第一类，比如产品名，或者对象名存储大小写，或者null值的排序规则等等，这些不会随着用户的使用而发生改变，所以在驱动里面都是直接写死的。

第二类，比如查询某个表有哪些列信息，某个表的外键信息等等，一般都是通过在jdbc侧拼出对应的sql语句，通过这些语句来从服务端查询出对应信息。

  


#   [5.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

1. JDBC4.3规范里面还有少量接口未支持，主要分布在元数据，可更新结果集，CallableStatement这几块，需要后续完善。
1. 性能瓶颈优化，主要是lob相关性能还比较差，需要后续优化。
1. 一些还未完成的功能特性，比如JDBC支持XA，JDBC支持UDT等。


