Created by 张周玺, last modified by  周湘淞 on 十月 18, 2024

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

增加对XMLTYPE的支持。    [[YDBRD-21398] jdbc驱动支持xmltype - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-21398)  

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

支持功能：

支持xmltype类型的参数绑定和查询。

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

*列出本方案对外提供的接口、配置参数、API等。*

*新实现接口如下：*

|类|接口|说明|
|---|---|---|
|Connection|createSQLXML（）|返回一个空的SQLXML对象|
|PreparedStatement|setSQLXML  (  int   index  ,   SQLXML xmlObject)|绑定SQLXML 类型的参数|
|CallableStatement|getSQLXML（int parameterIndex）|返回SQLXML 类型的出参|
|ResultSet|SQLXML   getSQLXML  (  int   index)|从结果集中获取SQLXML 类型的值|
||SQLXML   getSQLXML  (String columnName)||


  


除了以上新增接口，如下老接口也新增了对xml类型的支持。

|类|接口|说明|
|---|---|---|
|PreparedStatement|setString  (  int   index  ,   String value)|  
|
||setClob  (  int   index  ,   Clob clob)|  
|
||setObject  (  int   index  ,   Object object)|第二个参数支持SQLXML 类型的参数|
|CallableStatement|registerOutParameter  (  int   parameterIndex  , int   sqlType)|sqlType支持YasTypes.  SQLXML|
|ResultSet|Object   getObject  (  int   index)|xmltype类型getObject会返回SQLXML类型的值|
||String getString(  int   index)|  
|
||Clob getClob(  int   index)|  
|
||<  T  >   T   getObject  (  int   index  ,   Class<  T  > type) |type类型新增了对SQLXML的支持|


  


*SQLXML的接口*

|接口|是否实现|说明|
|---|---|---|
|free  ()|是|释放资源，free之后就不可操作了|
|getBinaryStream  ()|是|获取xml的字节流|
|setBinaryStream  ()|否|  
|
|getCharacterStream  ()|是|获取xml的字符流|
|setCharacterStream  ()|否|  
|
|getString  ()|是|获取xml内容|
|setString  (String value)|是|设置xml内容|
|<  T   extends   Source>   T   getSource  (Class<  T  > sourceClass)|是|把xml内容解析成常见的xml文档对象，支持,SAXSource，,DOMSource，,StreamSource，,StAXSource    
  四种类型，需要注意要解析成xml文档，必须要格式正确，否则可能抛出异常|
|<  T   extends   Result>   T   setResult  (Class<  T  > resultClass)|否|  
|


##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

目前服务端支持的xmltype仅限于把xml内容当成string/clob去存储，并不涉及xml的解析和格式校验等等，所以jdbc驱动目前也只支持对xml类型以String、clob、SQLXML类型来存取，其中SQLXML的实现仅仅是对String的简单包装，不支持除了setString之外的其它set接口。

##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

  


  


## .

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

  


开发完成后补充。

##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

  


*评估代码量KLOC、工作量（人天）。*

  


  


##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

不涉及。