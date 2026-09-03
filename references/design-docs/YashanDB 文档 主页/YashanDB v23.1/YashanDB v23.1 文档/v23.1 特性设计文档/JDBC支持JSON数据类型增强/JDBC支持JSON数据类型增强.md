Created by 张周玺, last modified on 八月 24, 2023

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

JDBC支持JSON数据类型。

之前由于服务端只实现了JSON标准类型，所以驱动实现了getString,setString接口，配合json三方件与String之间互转的能力，基本就可以满足要求。    [JDBC支持JSON数据类型 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=95106042)  

但是由于数据库服务端对json的能力做了增强，新增加了十几种扩展类型，json三方件将不再能满足要求，所以参照Oracle去定义自己的JSON模型，驱动端转成二进制与服务端进行交互。扩展类型参照：    [JSON扩展类型 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109596514)  

  


##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

支持功能：

1、读取、创建和修改JSON类型值。

2、以数据库使用的相同二进制JSON存储格式对JSON类型值进行编码/解码。

3、将JSON类型值转换为JSON文本和从JSON文本转换JSON类型值。

4、使用json三方件还是按标准json去处理，崖山扩展类型在json三方件中表现为数字或string。

  


##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

*列出本方案对外提供的接口、配置参数、API等*

  


***涉及的驱动标准接口***

PreparedStatement.setObject(int index,YasonValue value);

public   <  T  >   T   getObject  (  int   columnIndex  ,   Class<  T  > type); type类型传入YasonValue及子类。    
    
    
  如果传入的类型不对，会抛出不支持。

  


  


***Json的主要实现：***

```
Parser
```

|  
|父类|主要方法|子类|接口|备注|
|---|---|---|---|---|---|
|model|YasonValue|int getType   type要返回枚举。,getDeepth 最大深度,getString()    
  **(注： getString 与toString返回的**    
  **结果可能是不同的，**    
  **getString是对值进行toString.)**,toString 返回json格式的字符串,equals    
  hashCode,  
|YasonObject|**构造函数**  ：无参,  
,**map相关其它接口**,size    
  isEmpty    
  containsKey    
  containsValue    
  remove,clear    
  keySet    
  values    
  entrySet,  
,**get和put相关操作接口**,YasonValue get(key ),YasonValue get(key,YasonValue defaultValue ), X getXXX(key),X getXXX(key,Object defaultValue)    
  put(key,value)    
  putNull(key)    
  putAll  (Map<?   extends   String  ,   ?   extends   YasonValue> var1),  
|基于LinkedHashMap实现，Map<String  ,   OracleJsonValue>。    
    
,  
    
  get和getXXX接口都有两种实现,getXXX  (String var1) 正常根据key取value    
  getXXX  (String var1,Object defaultValue) 取不到就返回默认值，这个也符合一般json的使用习惯.    
    
  XXX为咱们支持的所有JSON标量数据类型    
  分别为String，number，bool,null,tinyint(对应到java就是byte getbyte),  smallint(get),integer,bigint,float,double,binary(对应java里面byte[]数组 getBinary)，  timestamp,date,time,yearmonthInterval(java的,Period getYMInterval  ),daysecondInterval(java里面  Duration, getDSInterval  )    
    
  put的value类型与get接口对应。|
||||YasonArray|**构造函数：**  无参,**list相关接口**,size    
  isEmpty    
  contains    
  iterator    
  toArray    
  containsAll    
  clear,indexOf    
  lastIndexOf    
  listIterator,  
,**get和put相关操作接口**,void   add  (  XXX   value)    
  void   addNull(),boolean   addAll  (Collection<?   extends   YasonValue> var1),YasonValue set(int index,YasonValue  value),YasonValue setNull  (  int   var1),boolean   remove  (Object var1),boolean   removeAll  (Collection<?> var1),YasonValue get(int index), X getXXX(int index),  
,转YasonValueList   ,public   <  T   extends   YasonValue> List<  T  >   getValuesAs  (Class<  T  > var1)|基于ArrayList实现，List<OracleJsonValue>   list   =   new   ArrayList()  ;    
    
    
  XXX为咱们支持的所有JSON标量数据类型    
,分别为String，number，bool,null,tinyint(对应到java就是byte getbyte),  smallint(get),integer,bigint,float,double,binary(对应java里面byte[]数组 getBinary)，  timestamp,date,time,yearmonthInterval(java的,Period getYMInterval  ),daysecondInterval(java里面  Duration, getDSInterval  ),  
|
||||YasonString|  
,  
,  
    
    
    
    
    
    
    
    
    
    
    
    
    
    
  所有的标量类型,参考Oracle.,提供 构造函数(XXX)和getXXX，XXXValue两种取值的接口，每一种类型支持的XXX类型见备注列.,标量类型值不可更改,  
,  
,构造函数里面如果传的value超过范围会报错。,  
,  
,  
|  
,对应String,构造函数支持常见所有类型,get只支持string,  
    
  YasonString yasonString1 = new YasonString(String value);    
  new YasonString(int value);    
    
    
  String s = yasonString1.getString();    
    
  String s1 = yasonString1.stringValue();    
    
|
||||YasonDecimal||对应number,  
,  
,**支持的XXX类型：byte/BigDecimal/int/short/double/float/long**,  
,  
|
||||YasonBoolean||**对应boolean**,**支持的XXX类型：boolean**,只有两种实例，直接定义在类里面|
||||YasonNull||**对应null**,**支持的XXX类型：无**,  
,  
,**new YasonNull();**,只有一种实例，直接定义在类里面|
||||YasonByte||**对应**  tinyint ,  
,**get与number一致，构造函数支持的XXX类型：byte/int/short**,  
|
||||YasonShort||**对应 **  smallint,  
,**get与number一致，构造函数支持的XXX类型：int/short**|
||||YasonI  nteger||**对应 int**,**get与number一致，构造函数支持的XXX类型：int**|
||||YasonBigI  nteger||**对应 bigint**,**get与number一致，构造函数支持的XXX类型：**  **long**|
||||YasonF  loat||**对应 float**,**get与number一致，构造函数支持的XXX类型：float**|
||||YasonDouble||**对应 double**,**get与number一致，构造函数支持的XXX类型：double**|
||||YasonB  inary||**对应 byte[]**,**支持的XXX类型：byte[]**,  
,** byte[] **  getB  inary();,**byte[] **  binaryValue();    
|
||||YasonT  imestamp||对应T  imestamp,**支持的XXX类型：**  LocalDateTime/T  imestamp/String|
||||YasonD  ate||对应Data,**支持的XXX类型：**,LocalDate/Date  /String|
||||YasonT  ime||对应Time,**支持的XXX类型：**  LocalTime/T  ime/String|
||||YasonIntervalDS||day second Interval,  
,对应  Duration,支持Duration/  String|
||||YasonIntervalYM||year month Interval,  
,对应  Period,支持 Period/  String|
|  [](https://docs.oracle.com/en/database/oracle/oracle-database/21/jajdb/oracle/sql/json/OracleJsonParser.html)    &    [](https://docs.oracle.com/en/database/oracle/oracle-database/21/jajdb/oracle/sql/json/OracleJsonGenerator.html)      
    
  需要注意的是，Oracle的这两个类提供的所有功能的交互对象都是IO流|YasonGenerator|提供一步一步组装JSON的操作接口。    
  用户可以调如下接口组装出一个json    
    
  writeStartObject    
  writeStartArray    
  writeKey    
  write    
  writeNull    
  writeEnd    
  writeParser    
  close    
  flush|JsonSerializerImpl|  
|一步一步组装json，生成json字符串,JsonSerializerImpl提供的是把key-value组装成字符串的原始能力,  
,Writer writer =   new   StringWriter()  ;    
  OracleJsonGenerator generator = factory.createJsonTextGenerator(writer)  ;    
  generatorWrite  (generator)  ;    
    
  String s= writer.toString()  ;|
||||YasonGeneratorImpl|  
|一步一步组装json，生成json二进制byte数组,YasonGeneratorImpl提供的是把key-value组装成二进制数组的原始能力|
||YasonParser|通过如下接口去探知json的完整结构,Event是一个  enum，  表示所有的可能的json数据类型.,根据类型配合hasNext和next方法去调如下接口可以探测出完整的json结构。其实这个事情看不出来有什么意义，如果不实现这完整的功能的话我觉得只实现下面加粗的接口就可以了,  
  hasNext    
  next    
  getXXX 类型与支持的类型保持一致    
  **getValue**    
  **getArray**    
  **getObject**    
  skipArray    
  skipObject    
  close。,  
|JsonParserImpl|  
|  
,构造方法会有一个包含json字符串的输入流，从json字符串解析获取Json对象,  
,JsonParserImpl提供的是把字符串解析成（基于map/list实现的）Json对象的原始能力|
||||YasonParserImpl|  
|  
,构造方法会有一个包含json二进制byte数组的输入流，从json二进制byte数组获取Json对象,  
,YasonParserImpl提供的是把二进制数组解析成（基于二进制实现的）Json对象的原始能力.|
|  [](https://docs.oracle.com/en/database/oracle/oracle-database/21/jajdb/oracle/sql/json/OracleJsonFactory.html)  |YasonFactory|分如下几类    
    
  获取    [Parser](https://docs.oracle.com/en/database/oracle/oracle-database/21/jajdb/oracle/sql/json/OracleJsonParser.html)    &    [Generator](https://docs.oracle.com/en/database/oracle/oracle-database/21/jajdb/oracle/sql/json/OracleJsonGenerator.html)  ,  
  createYsonTextParser    
  createYasonTextGenerator    
    
  获取可操作的json对象,createObject,createArray,createString/Decimal/Double...等等标量类型    
    
  根据字符串或者二进制生成json对象，这里依赖的就是上面Parser的能力,  
,createJsonTextValue,  
,  
    
|  
|  
|  
|


注：红色为暂不实现的。

  


##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

  


JSON-P接口（javax.JSON）相关先不实现。

与string互转时的extended和pretty参数，Oracle驱动端是没有，我也没找到Java里面使用那个的场景，先不实现。

Oracle基于二进制实现的model及相关的    [](https://docs.oracle.com/en/database/oracle/oracle-database/21/jajdb/oracle/sql/json/OracleJsonParser.html)    &    [](https://docs.oracle.com/en/database/oracle/oracle-database/21/jajdb/oracle/sql/json/OracleJsonGenerator.html)    先不实现。

  


  


  [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

  


相互之间的转换关系是：

插入时，把map/list实现的model转二进制传给服务端。

查询时，把二进制解析成map/list实现的model返回给用户。

字符串转map/list实现的model，使用YasonParserImpl。

model转字符串，使用JsonSerializerImpl。

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

  


  


##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

  


*评估代码量KLOC、工作量（人天）。*

  


  


##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

不