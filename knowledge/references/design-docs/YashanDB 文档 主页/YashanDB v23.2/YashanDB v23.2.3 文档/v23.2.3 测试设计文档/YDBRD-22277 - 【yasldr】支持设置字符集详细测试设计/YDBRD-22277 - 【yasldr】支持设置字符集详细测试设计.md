Created by 范瑜, last modified on 十月 14, 2024

# **1.概述**

SR：    [https://pingcode.yasdb.com/pjm/items/661156eb579a3edb84d68e71](https://pingcode.yasdb.com/pjm/items/661156eb579a3edb84d68e71)    ?    
  #YDBRD-19203 【yasldr】支持设置字符集

开发设计：    [yasldr导入支持设置字符集 - 程康 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=141588180)  

需求背景：   当文件和目标端数据库的字符集为GBK，使用yasldr工具需要读取yasc_env.ini文件，并需要在文件指明CHARACTER_SET=GBK才能导入成功，将字符集作为yasldr的配置项

交付版本：23.2.3.100

交付形态：单机、集群、分布式（  服务端不支持gbk字符集，gb18030服务端sr还未合入  ）

# **2.需求分析**

## **2.1 功能点分析**

yasldr命令行增加character_set配置参数

|命令参数|作用|取值|备注|
|---|---|---|---|
|character_set|解析csv文本字符集|可选范围：UTF8、GBK、GB18030、ISO88591、ASCII,默认值：不设置character_set情况下， 以客户端字符集为准|  
|


## **2.3 规格约束**

无 

# **3. 详细测试设计**

## **3.1 测试设计方法**

（1）针对导入流程中涉及字符集因素，使用场景法进行测试分析和设计。

（2）新增命令参数character_set使用边界值方法测试参数，配置生效情况需要结合场景法进行测试

### 3.1.1 测试分析

对主要应用场景分析：

|步骤|测试因素|
|---|---|
|第一步：用户准备数据（csv文件）|（1）数据来源：同构/异构数据库、用户自己构造等,（2）csv文件字符编码方式,（3）csv文件大小,（4）csv文件内容|
|第二步：准备目标库|（1）部署模型,（2）数据库配置,（3）对象|
|第三步：执行导入|（1）客户端配置：字符集等,（2）命令行/ctl文件解析,（3）导入功能|
|第四步：确认导入结果|（1）数量,（2）内容,（3）导入后产生结果文件：bad文件、discard文件、log文件、yasldr的log文件|
|第五步：执行其他业务（dml、dql）|（1）业务执行|


针对以上测试因素，分析与字符集相关的测试点

数据库层相关测试因子如下：

|因子|因子值1|因子值2|因子值3|因子值4|因子值5|因子值6|
|---|---|---|---|---|---|---|
|操作系统|linux|arm|windows|  
|  
|  
|
|部署模型|单机|分布式|集群|  
|  
|  
|
|数据库字符集|UTF8|GBK|GB18030|ISO88591|ASCII|UTF16|
|表类型|HEAP|TAC|LSC|  
|  
|  
|
|分区类型|非分区表|HASH|RANGE|LIST|二级分区|  
|
|字段类型|数据库字符集：,TINYINT、SMALLINT、INTEGER、BIGINT、FLOAT、DOUBLE、NUMBER、,CHAR、DATE、TIME、TIMESTAMP、INTERVAL YEAR TO MONTH、INTERVAL DAY TO SECOND、BOOLEAN、VARCHAR、CLOB、BLOB、JSON、RAW(SIZE)、UDT类型、  BIT、ROWID、|国家字符集：,NCHAR、NVARCHAR、NCLOB|  
|  
|  
|  
|


  


工具层相关测试因子如下：

|因子|因子值1|因子值2|因子值3|因子值4|因子值5|因子值6|
|---|---|---|---|---|---|---|
|导入方式|yasldr|yasboot（次要）|  
|  
|  
|  
|
|CSV文件字符集|UTF8|GBK|GB18030|ISO88591|ASCII|UTF16|
|终端会话字符集|UTF8|GBK|GB18030|ISO88591|ASCII|UTF16|
|命令行/ctl文件字符集|UTF8|GBK|GB18030|ISO88591|ASCII|UTF16|
|导入结果文件字符集：bad文件、discard文件、log文件、yasldr的log文件|UTF8|GBK|GB18030|ISO88591|ASCII|UTF16|
|导入主要功能|basic（次要）/batch（主要）|bulkload/非bulkload导入|lob导入（lobfile、lls）,lob文件字符集|优雅报错|文件拆分,拆分后文件字符集|  
|
|导入辅助功能|多文件多表|多种分隔符/包围符|trailing nullcols/trim?|  
|  
|  
|


### 3.1.2 功能测试

（1）对测试框架公共方法临时增加字符集参数， 先跑上车过滤是否有core和基本功能问题。  存量用例都是用utf8编写的， 改为其它字符集时用例可能会有问题，具体问题到测试时再分析

（2）优先测试客户端字符集和数据库字符集一致的场景

前置条件：

字符集服务端和指定字符集正交

|  
|UTF8|GBK|GB18030|ISO88591(次要)|ASCII（次要）|
|---|---|---|---|---|---|
|UTF8|  
|  
|  
|  
|  
|
|GBK|  
|  
|  
|  
|  
|
|GB18030|  
|  
|  
|  
|  
|
|ISO88591(次要)|  
|  
|  
|  
|  
|
|ASCII（次要）|  
|  
|  
|  
|  
|


表类型：heap、tac、lsc

以上表格作为前置条件

|序号|测试项|测试子项|观察点|备注|
|---|---|---|---|---|
|1|字段类型|1、字段类型为数值类型：,（1）整数类型：tinyint、smallint、int、bigint,（2）浮点类型：float、double,（3）number类型：number,2、字段值：,（1）整数类型：null、边界值,（2）浮点类型：null、边界值、inf、-inf、nan,（3）number类型：null、边界值,（4）bit类型：null、二进制、自定义边界长度、类型边界长度|数值类型应与字符集无关，在前置条件下， 都可以导入成功|无特殊说明需要覆盖前置条件|
|2|  
|1、字段类型为  布尔型,2、字段值：,（1）字符型：  'true'、't'、 'yes'、 'y'、 'on'、 '1'、'false'、'f'、 'no'、 'n'、 'off'、 '0',（2）标识符：true、false,（3）整形数值：非0整数、0,（4）null|boolean类型应与字符集无关，在前置条件下， 都可以导入成功|  
|
|3|  
|1、字段类型为  ROWID/UROWID/ST_GEOMETRY  :,2、字段值：,（1）null、正常格式|ROWID/UROWID/ST_GEOMETRY类型应与字符集无关，在前置条件下， 都可以导入成功|  
|
|4|  
|1、字段类型为  日期类型:,（1）日期时间类型：date、time、timestamp,（2）间隔类型：interval  year to month、interval day to second,2、字段值：,（1）日期时间类型：null、时间边界、时间格式，  如只有年-月无日  等,（2）间隔类型：null、时间边界、时间格式，缺少部分时间等|  
|  
|
|5|  
|1、字段类型为数据库字符集字符型：,（1）定长类型：char、char(size （char）),（2）非定长类型：varchar、varchar(size (char)),2、字段值：,（1）定长类型：null、空串、空格、自定义边界长度、类型边界长度、特殊字符(表情包、中文、其它国语言),（2）非定长类型：null、空串、空格、自定义边界长度、类型边界长度、特殊字符(表情包、中文、其它国语言)|1、字符集1在字符集2中有找到码点：,（1）字段定义长度大于转换后字符长度，则导入成功,（2）字段定义长度小于转换后字符长度， 则导入报错,2、字符集1在字符集2中没有找到码点，则导入乱码或者  导入报错|  
|
|6|  
|1、字段类型为数据库国家字符集字符型：,（1）定长类型：  nchar,（2）非定长类型：  nvarchar,2、字段值：,（1）定长类型：null、空串、空格、自定义边界长度、类型边界长度、特殊字符(表情包、中文、其它国语言),（2）非定长类型：null、空串、空格、自定义边界长度、类型边界长度、特殊字符(表情包、中文、其它国语言),3、yasldr导入方式覆盖：  —有关系，需要全量覆盖，表名和字段名有关系,（1）basic,（2）batch,4、yasldr导入模式,覆盖：,（1）bulkload,（2）非bulkload|1、字符集1在字符集2中有找到码点：,（1）字段定义长度大于转换后字符长度，则导入成功,（2）字段定义长度小于转换后字符长度， 则导入报错,2、字符集1在字符集2中没有找到码点，则导入乱码或者导入报错|  
|
|7|  
|1、字段类型为大对象类型：,（1）clob、nclob,（2）blob,2、字段值：,（1）clob、nclob：定长类型：null、空串、空格、自定义边界长度、类型边界长度、特殊字符(表情包、中文、其它国语言),（2）blob：二进制,3、yasldr导入方式覆盖：,（1）basic,（2）batch,4、yasldr导入模式,覆盖：,（1）bulkload,（2）非bulkload,5、  lob导入（lobfile、lls）  --跟oracel对比|1、clob、nclob：字符集1在字符集2中有找到码点则导入成功，否则导入乱码,2、blob：二进制，与字符集无关,  
|  
|
|8|  
|1、字段类型为  json类型（服务端只支持utf8）  、  XMLTYPE类型  ：,2、字段值：,（1）json基本类型、json扩展类型,（2）  XMLTYPE类型,3、yasldr导入方式覆盖：,（1）basic,（2）batch,4、yasldr导入模式,覆盖：,（1）bulkload,（2）非bulkload,5、  lob导入（lobfile、lls）|字符集1在字符集2中有找到码点则导入成功，否则导入乱码|  
|
|9|分区类型|1、分区类型，覆盖：  range、range interval、hash、list、二级分区,2、  分区键类型：,（1）数值型,（2）  日期类型,3、分区条件：,（1）  hash分区,（2）range和list分区：常量、表达式,4、yasldr导入方式覆盖：batch|分区键类型与字符集无关，在前置条件下， 都可以导入成功，且导入的分区正确|  
|
|10|  
|1、分区类型，覆盖：  range、range interval、hash、list、二级分区,2、  分区键类型：数据库字符集字符型/数据库国家字符集字符型,3、分区条件：,（1）  hash分区,（2）range和list分区：常量、表达式,4、yasldr导入方式覆盖：batch|1、字符集1在字符集2中有找到码点：,（1）字段定义长度大于转换后字符长度，则导入成功， 且导入的分区正确,（2）字段定义长度小于转换后字符长度， 则导入报错,2、字符集1在字符集2中没有找到码点，则导入乱码或者导入报错|  
|
|11|其它项|1、命令行/ctl文件字符集，覆盖所有字符集， 注意以下：,（1）数据库对象：字段名、用户名、表名等,（2）ctl文件：有注释、文件路径等,覆盖对应字符集字符,2、yasldr导入方式覆盖：,（1）basic,（2）batch,3、按照客户端字符集解析|  
|（1）字符集一致场景在以上两测试项进行验证,（2）其它项测试点不需要覆盖所有字符集正交场景，挑选部分测试即可|
|  
|  
|导入有容错，容错类型覆盖：,（1）服务端容错：违反索引约束等,（2）客户端容错：数据类型不一致， 超过定义长度等,使bad、dsc、log文件有内容， 观察bad、dsc、log、yasldr的log文件字符集|1、bad、dsc文件字符集与数据文件字符集一致,2、log、yasldr的log文件字符集与终端会话字符集一致|  
|
|12|  
|文件拆分，观察拆分后文件字符集|拆分后文件字符集与数据文件字符集一致|  
|
|13|  
|多文件导入：,（1）所有文件字符集一致,（2）部分文件字符集不一致|  
|  
|
|  
|  
|lob导入(lobfile、lls)：,（1）csv文件与lob文件字符集一致,（2）csv文件与lob文件字符集不一致|  
|  
|
|14|  
|csv文件字符集与指定字符集不一致|不一致是报错，还是怎么处理？,可能解析报错|  
|
|15|  
|命令行终端会话与指定字符集不一致，   用终端字符集|  
|  
|
|16|  
|在大小端下， 指分隔符和包围符|  
|  
|
|17|  
|使用客户端包|  
|  
|
|18|  
|use_native_type=false下导入|  
|  
|
|19|  
|组网：单机、分布式、集群|  
|  
|
|20|  
|带由withembeded选项，在csv_chunk_size的位置正好是多字节字符，多字节字符后有换行|  
|  
|
|  
|  
|使用exp --csv导出再导入|  
|  
|
|  
|  
|操作系统：windows、linux、arm|  
|  
|
|  
|  
|不关注yasboot|  
|  
|


### 3.1.3 参数校验

|参数|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|
|character_set,可选范围：UTF8、GBK、GB18030、ISO88591、ASCII,默认值：不设置character_set情况下， 以客户端字符集为准|1、参数大小写,2、值大小写,3、重复设置,4、值有无单、双引号包围|生效情况由正常功能进行验证|非  UTF8、GBK、GB18030、ISO88591、ASCII字符，如：,（1）空串,（2）类似字符：asicc,（3）超长,（4）其它字符集|  
|


### 3.1.4 并发/异常测试

异常打印的时候多字节字符是否会有影响

（1）工具端只增加了一个参数， 内部逻辑无大变动， 因此不涉及并发和异常

（2）服务端场景由服务端字符集工程看护，因此此次不关注并发和异常

### 3.1.5 性能测试

只关注字符集一致场景的性能，关注在  UTF8、GBK、GB18030字符集下导入性能

|序号|测试场景|预期结果|备注|
|---|---|---|---|
|1|csv文件全是单字节字符， yasldr导入|（1）UTF8、GBK、GB18030字符集性能应相差不大,（2）各个组网下性能相差不大|英文字母：,字节数 : 1;编码：GB2312,字节数 : 1;编码：GBK,字节数 : 1;编码：GB18030,字节数 : 1;编码：ISO-8859-1,字节数 : 1;编码：UTF-8,字节数 : 4;编码：UTF-16,字节数 : 2;编码：UTF-16BE,字节数 : 2;编码：UTF-16LE,  
,中文汉字：,字节数 : 2;编码：GB2312,字节数 : 2;编码：GBK,字节数 : 2;编码：GB18030,字节数 : 1;编码：ISO-8859-1,字节数 : 3;编码：UTF-8,字节数 : 4;编码：UTF-16,字节数 : 2;编码：UTF-16BE,字节数 : 2;编码：UTF-16LE|
|2|csv文件全是多字节字符，数据类型覆盖：,（1）SQL CHAR数据类型（char、varchar2、clob）,（2）SQL NCHAR数据类型（nchar、nvarchar2、nclob）|（1）在数据库字符集下，  GBK、GB18030字符集性能应相差不大， UTF8性能比GBK、GB18030性能低,（2）在数据库国家字符集下， 比（1）性能低|  
,  
|


## **3.2 详细测试设计**

1. *使用章节1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|**系统级DFX分类**|**是否涉及**|**测试点**|
|---|---|---|
|CT|否|  
|
|KT|否|  
|
|长稳|否|  
|
|一致性|否|  
|
|三方测试工具    
  (sqltest，sqlancer)|否|  
|
|安全|否|  
|
|DFR|否|  
|
|HA|否|  
|
|压力|否|  
|
|性能|是|同上一章节|
|可维护性|是|同上一章节|


  


# **4. 测试用例**

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

[YDBRD-22277【yasldr】支持设置字符集文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjQ4OTcwYzJhZjRmNTIwZjZiIiwicmVmX2lkIjoiNjczOTZjZjQ3MjgyMDZlZmI5MmYxOTBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0OTE3LCJleHAiOjE3ODIzOTEzMTd9.ld45avitLBV75b9_XVWo41bauPguiQuW87CAXwQjpN4)

  


# **5. 测试框架设计**

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


导入导出测试框架

# **6. 测试环境说明**

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# **7. 工作量评估**

工作量：7

计划测试完成时间：

## Attachments:

[image2023-12-19_10-48-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjRhMWFkOWEzMzExZGM4ZGRhIiwicmVmX2lkIjoiNjczOTZjZjQ3MjgyMDZlZmI5MmYxOTBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0OTE3LCJleHAiOjE3ODIzOTEzMTd9.llPExuUP_V2yGdZVOneQUCpJalnu4rAH8OL17uShsGo)

 (image/png)    


[YDBRD-22277【yasldr】支持设置字符集文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjQ4OTcwYzJhZjRmNTIwZjZiIiwicmVmX2lkIjoiNjczOTZjZjQ3MjgyMDZlZmI5MmYxOTBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0OTE3LCJleHAiOjE3ODIzOTEzMTd9.ld45avitLBV75b9_XVWo41bauPguiQuW87CAXwQjpN4)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要：    
  与会人：程康、贺国峰、陈钦卿、范瑜    
  评审时间：2024.05.13 15:00:00    
  评审地点：线上会议    
  评审纪要信息：    
  1、basic模式下， 表名和字段名等需要做字符集转换    
  2、ctl文件按照客户端字符集解析，命令行命令使用终端字符集解析    
  3、补充windows版本测试    
  4、此次不关注yasboot    
  5、异常打印的时候多字节字符会与字符集有关    
  6、多文件、lob与csv文件字符集不一致的情况下，开发正在调研，待调研结束后会给出相关规格,Posted by fanyu at 五月 13, 2024 16:24|
|---|
|  [](null)  ,7、此次不关注大小端,Posted by fanyu at 五月 13, 2024 17:52|
