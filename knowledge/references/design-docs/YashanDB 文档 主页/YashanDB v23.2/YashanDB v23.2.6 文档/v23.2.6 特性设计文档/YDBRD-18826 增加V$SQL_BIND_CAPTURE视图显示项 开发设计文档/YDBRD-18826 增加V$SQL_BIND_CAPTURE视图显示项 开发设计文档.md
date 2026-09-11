Created by 陈秋富 on 十月 14, 2024

# **适用场景：IR/SR特性的详细设计文档**

*详细设计-YDBRD-18826 : V$SQL_BIND_CAPTURE Design（增加V$SQL_BIND_CAPTURE视图显示项 方案设计）*

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2ac](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2ac)    *?#YASHAN-860 V$SQL_BIND_CAPTURE视图支持记录SQL的绑定变量信息*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66115281579a3edb84d67586](https://pingcode.yasdb.com/pjm/items/66115281579a3edb84d67586)    *?#YDBRD-18826 增加V$SQL_BIND_CAPTURE视图显示项*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

v$sql_bind_caputre视图打印绑定参数的具体值信息。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

新增v$sql_bind_capture视图实时记录SQL绑定参数具体得值信息。

**特性支持的部署形态为 主备(单机)、分布式、集群。**

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

**oracle: **    [v$sql_bind_capture视图 - 陈秋富 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=163014998)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|v$sql_bind_capture视图字段显示|  [V$SQL_BIND_CAPTURE - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/V%24SQL_BIND_CAPTURE)  |是|是|
|  
|变量窥视功能|  [变量窥视 特性设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=113967853)  |是|是|
|可修改性|配置参数部分|支持系统参数级别修改,_cursor_bind_capture_interval   ,收集得时间间隔参数|是|是|
|周边配合|内存使用|挂载在planContext结构上，使用sql main pool本身的内存。|是|是|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**无**

###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|SQL语法|select * from v$sql_bind_capture;|视图查询语句|是|
|动态视图|v$sql_bind_capture|具体视图字段含义参考文档,  [V$SQL_BIND_CAPTURE - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/V%24SQL_BIND_CAPTURE)  |是|
|配置参数|_cursor_bind_capture_interval   |系统级别配置参数，绑定参数收集的间隔时间。,默认值：900 (单位 秒),范围为：[0, 2147483647]   32位数值的一半|是|
|内存部分|使用的内存为 sql_main_pool|绑定参数的值信息挂载在planContext结构上|是|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**1、针对于分布式：视图不支持收集dn汇聚上来的。该视图语句不会生成分发到dn的计划。收集的视图信息为当前直连的节点。**

**2、绑定参数只能支持显示简单数据类型，不包括大对象LOB、JSON、XML等**

**支持显示的类型：BOOL、TINYINT、SAMLLINT、INTEGER、BIGINT、FLOAT、DOUBLE、NUMBER、DATE、TIME、TIMESTAMP、INTERVAL、CHAR、VARCHAR、NCHAR、NVARCHAR、RAW、BIT、ROWID**

**3、oracle文档说明只能支持出现在谓词filter中的绑定参数显示。而yasdb都支持。**

**4、关于视图字段中的was_captured字段，表示是否存储了绑定参数值。位于投影列时候为NO，包括位于投影列的bool表达式中。**

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

###   [4.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)    视图字段变更说明

下表原设计来自于：    [V$SQL_BIND_CAPTURE - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/V%24SQL_BIND_CAPTURE)  

|字段|类型|说明|新增修改|
|---|---|---|---|
|ADDRESS|RAW(8)|SQL地址|  
|
|HASH_VALUE|BIGINT|SQL的哈希值，由SQL文本计算得到|  
|
|SQL_ID|VARCHAR(13)|唯一标识一条SQL语句的ID值，具体算法通过SQL文本的哈希/加密运算获得|  
|
|CHILD_ADDRESS|RAW(8)|子游标地址|  
|
|CHILD_NUMBER|INTEGER|子游标编号|  
|
|NAME|VARCHAR(64)|绑定变量的名称  **（保留字段）**|新增绑定参数变量名称显示，超过限制大小会截断。|
|POSITION|INTEGER|绑定变量在SQL中的位置|  
|
|DUP_POSITION|INTEGER|如该绑定变量在SQL中有重复使用，则此列的值设置为首个扫描到的绑定变量的位置  **（保留字段）**|如该绑定变量在SQL中有重复使用，则此列的值设置为首个扫描到的绑定变量的位置  **。**,**显示第一个绑定该参数的位置。**|
|DATATYPE|INTEGER|绑定变量数据类型的内部标识符|  
|
|DATATYPE_STRING|VARCHAR(22)|绑定变量数据类型的文本表示|  
|
|CHARACTER_SID|INTEGER|国家/地区字符集标识符  **（保留字段）**|  
|
|PRECISION|INTEGER|绑定变量的精度  **（保留字段）**|绑定变量的精度，数值型有效|
|SCALE|INTEGER|绑定变量的范围  **（保留字段）**|绑定变量的范围，数值型有效|
|MAX_LENGTH|INTEGER|绑定变量的最大长度|  
|
|WAS_CAPTURED|VARCHAR(3)|表示绑定变量的值是否被捕获  **（保留字段）**|表示绑定变量的值是否被捕获（YES/NO），表示是否存储了绑定参数具体值。,**oracle：当位于sql语句中的投影列位置的时候，该值为NO。**,**yasdb：位于投影列的bool表达式中时，也是NO。**|
|LAST_CAPTURED|DATE|最近一次捕获绑定变量的时间  **（保留字段）**|绑定参数加载的时间，更新周期受系统参数 _cursor_bind_capture_interval 影响|
|VALUE_STRING|VARCHAR(4000)|绑定变量的值，使用字符串表示  **（保留字段）**|具体绑定参数的内容。超过最大限制的绑定参数会被截断。|


###   [4.2](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)     内存空间部分

1、使用PlanContext上面挂载的MemoryContext分配出来的空间。

2、针对于planContext内存的读写需要加锁spinLock

3、  **新增数据结构用于管理从流程1中分配出来的内存空间。（这段内存可支持重新写入内容。）**

**（1）由blockid+offset指向memoryContext中某段起始地址**

**（2）由itemLen表明该段数据长度。**

**（3）数据连续存放。新增对应结构的读写接口。**

```
typedef struct StMctxItemMngr {
    MemoryContext* owner;
    CodUint16*     blockIds;
    CodUint16*     offsets;
    CodUint16*     itemLens;
    CodUint16      startBlockId;
    CodUint16      startPos;
    CodUint16      capacity;
    CodUint16      count;
} MctxItemMngr;

typedef struct StMctxItem {
    CodChar*  data;
    CodUint32 len;
} MctxItem;

CodVoid mctxItemMngrReset(MctxItemMngr* pMctxItemMngr);
CodResult mctxItemMngrAlloc(MemoryContext* mctx, CodUint32 itemCount, MctxItemMngr** pMctxItemMngr);
CodResult mctxItemMngrAdd(MctxItemMngr* mctxItemMngr, MctxItem* item);
CodResult mctxItemMngrGet(MctxItemMngr* mctxItemMngr, CodUint16 idx, MctxItem* item);
```

4、数据的内存排布如下图，分成元数据信息+具体值的方式。

（1）定长数据如 整型、时间类型、BOOL等 按相应固定大小存放。

（2）变长数据如 字符类型 按最大长度为4000字符长度存放。

（3）针对于大对象如LOB、JSON、XML等则只存其元数据信息。

![](https://pingcode.yasdb.com/atlas/files/public/67396e00a1ad9a3311dc94ad/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFDQWdBQUFBQUlBQUFBQUFCUUFBQUFBQUFBQ0FBQUFBQUVBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM0NTIsImV4cCI6MTc4MjMyNDI1Mn0.2lu72ewj0yBtrGVZZ8H7y-A8Q36RJwezC48hhOmqIFI)

  


###   [4.3 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)    系统参数部分

新增系统参数   _cursor_bind_capture_interval，默认值为900，单位秒。

取值范围为 [0,  2147483647]

###   [4.4 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)    处理时序

1、绑定参数所需内存的分配由创建planContext的过程中产生。

2、更新绑定参数内容，位于变量窥视挂载上具体执行plan之后。

3、图中步骤9更新planContext上挂载绑定参数信息时候，需要在锁内操作。并且在时间间隔  _cursor_bind_capture_interval之内。

![](https://pingcode.yasdb.com/atlas/files/public/67396e008970c2af4f52163d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFDQWdBQUFBQUlBQUFBQUFCUUFBQUFBQUFBQ0FBQUFBQUVBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM0NTIsImV4cCI6MTc4MjMyNDI1Mn0.2lu72ewj0yBtrGVZZ8H7y-A8Q36RJwezC48hhOmqIFI)

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1、常规：考虑不同绑定参数的存储情况。包括定长数据、变长数据、大对象数据。

2、视图中name和value_string超过限制长度截断的情况。

3、定时更新的情况。主要是系统参数   _cursor_bind_capture_interval   

4、并发场景下。读写同时访问这块内存数据情况。

5、涉及到存储过程中定义的绑定参数信息。

6、极限场景，最多多少个绑定参数。4096 * 4000 ？  16M？

7、批量绑定和分布式绑定的场景。

8、超过一个页面block大小的数据。

9、  绑定参数位于不同位置   dml包括 insert into select等场景。

##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

1、后续如果实现了常量改写成绑定参数的功能。

2、针对于number类型的绑定。 不同ps的number类型数据会指向同一个number类型的plan。打印的那条数据，为第一次绑定时候的类型。可能会有歧义。

## Attachments:

[image2024-9-4_16-4-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZmZhMWFkOWEzMzExZGM5NGFjIiwicmVmX2lkIjoiNjczOTZkZmY1OTNmOTljOWZmMjM4MTUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNDUyLCJleHAiOjE3ODIzOTk4NTJ9.1xmuI-XyPfoG54_P07u7Hl2garKZJMf6lI7NDO4o0OU)

 (image/png)    


[image2024-9-4_15-52-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZmY4OTcwYzJhZjRmNTIxNjNiIiwicmVmX2lkIjoiNjczOTZkZmY1OTNmOTljOWZmMjM4MTUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNDUyLCJleHAiOjE3ODIzOTk4NTJ9._Iah116y0lA_sXRom3CcQyWk4C6zKgr4SZIycP83bpg)

 (image/png)    


[image2024-9-4_15-52-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDA4OTcwYzJhZjRmNTIxNjNjIiwicmVmX2lkIjoiNjczOTZkZmY1OTNmOTljOWZmMjM4MTUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNDUyLCJleHAiOjE3ODIzOTk4NTJ9.O083rSv_XamS9ZBgycpKqmDHk_U8UJ2KclkFKXzeSzA)

 (image/png)    
