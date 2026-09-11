Created by 张欣, last modified on 十二月 19, 2023

**测试概要设计基于IR粒度**

**测试概要设计目的：**    
         1）从需求和调研出发梳理测试设计和策略    
         2）给测试详细设计做输入

IR链接：    [YDBRD-9954](https://jira.yasdb.com/browse/YDBRD-9954?src=confmacro)    -  支持DBMS_LOB高级包和特定子函数  完成

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

需求描述：    
  支持DBMS_LOB内置系统包    
    
  需求范围：    
  1、单机，集群 （集群天然支持 lob 部分，事务相关可能有差异 下面分析），分布式不支持需要拦截    
  2、包含行列 （行列lob存在区别）    
    
  需求规格：    
  1.实现子函数包含如下    
  CLOSE    
  ISOPEN    
  OPEN    
  CREATETEMPORARY    
  FREETEMPORARY    
  ISTEMPORARY    
  READ    
  WRITE    
  APPEND    
  WRITEAPPEND    
  COPY    
  ERASE    
  INSTR    
  TRIM

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

### 2.1 子函数和视图

|子过程|temp lob的创建和释放    
    
    
|createtemporary|
|---|---|---|
|||freetemporary|
|||istemporary|
||lob读写|read|
|||write|
|||append|
|||writeappend|
|||copy|
||lob的打开和关闭|open|
|||close|
|||isopen|
||lob处理|erase|
|||trim|
|||instr|
|常量,  
,  
|lob size最大值,amount, offset参数|lobmaxsize = 2^63-1,即bigint最大值|
||temp lob持续时间,createtemporary dur参数|~~session = 10~~|
|||~~call = 12~~|
||以何种模式打开lob,open   open_mode  参数|lob_readonly = 0|
|||lob_readwrite = 1|
|**视图**|v$temporary_lobs|  
|


各个函数详细规格和约束见调研文档：    [DBMS_LOB 测试调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=138554872)  

### 2.2 LOB

LOB分类：

临时LOB    
  temp lob in row：<=32000字节    
  temp lob out row：>32000字节

持久LOB    
  knl lob in row：<=4000字节（包括head，即LobCoupon.data前占12字节）    
  knl lob out row：>4000字节

列存：

knl lob in row：<=32000字节    
  knl lob out row：>32000字节   copy逻辑有差异

memory LOB

v$sql,v$sql_area,v$sql_stats 视图的SQL_FULLTEXT 字段是clob类型。

  


外部LOB（BFILE）：暂不支持

  


支持的lob类型：

blob,clob,nclob

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

每个方法的约束在调研文档合详细文档中罗列。

**一些公共的规格约束：**

- lob长度当前最大4G;
- lob_loc 不可使用未初始化的或设置为null的LOB定位符 或无效的定位符，否则报错；
- amount，offset，buffer 等参数不可为空；
- 对于knl LOB,读写前select into 需要for update 加行锁，否则报错；
- clob/nclob -nchar/char/nvarchar/varchar 等n类型和非n类型之间可以转换；
- 如果打开了LOB，则必须在提交事务之前关闭它，否则报错；


  


**和友商的差异点：**

instr函数的lob_loc参数为null,yashan报错“参数不可为null”；友商由于支持重载，会报错”太多的声明匹配这个调用“；

lob当前机制，write、WRITEAPPEND、copy等写函数，erase等处理函数 yashan当前的实现是先删除旧的lob,处理后 放一个新的lob,lobid 会更新，所以部分场景会存在找不到对象。(    [YDBRD-24100](https://jira.yasdb.com/browse/YDBRD-24100?src=confmacro)    -  【lob】knl lob更新后表里的lob lobid会更新,影响lob高级包部分使用场景  问题已转需求  )

  


##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

*需求本身的主要应用场景*

1.打开关闭函数。

open方法可以以只读和读写两种模式打开lob,通常和读写函数，处理函数结合使用。即使不使用open打开，lob也可以做读写、处理操作。

2.读写函数，处理函数

读写函数，会涉及lob的长度改变。如inline lob write后长度超过4000 变成outline 的；处理函数如trim 会截断，可能outline会转成inline；

读写函数，处理函数 要测试单场景使用验证功能，也要测试混合场景。

3.lob的赋值方式

select into 从表中查询到的knl lob数据可以赋值给lob locator; 如update修改表中的数据，lob的值也会一起变化（一些查询场景查询得到还是旧值，原因是获取的是带快照的信息）;修改knl lob的值，表中lob数据也会变化。

tmp lob不是从表中获取，和其他类型变量的生命周期类似。可以使用 := 初始化赋值，修改值，或者使用变量赋值；

lob locator 之间也可以互相赋值。

  


一些单场景示例

  


  


*需求与其他特性的关联场景*

高级包本身相对独立，本次4个SR中的高级包结合使用。与其他特性相关性比较强的是lob本身的一些特性。

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*1.说明测试设计的整体思路，明确测试范围，规格限制。可以使用流程图、逻辑覆盖等方法体现测试思路。*

*2.关键数据、测试场景的构造方法，用例自动化方法，可能涉及的测试框架说明。*

*3.关联特性：如导入导出、审计、权限等*

权限

特殊用户 如sys

*涉及新增数据库语法，需要考虑系统权限和系统审计；*

*涉及数据库对象的特性测试，需要考虑对象级权限、对象级审计、导入导出、对象安全访问和主备同步实现；*

*涉及新增数据类型，需要考虑在已支持的各类场景和对象中使用、导入导出等；*

*4.分布式、集群、列表不支持的特性，需要考虑补充拦截用例*

###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*性能、高可用、CT、KT、可维护性、可测试性、一致性、长稳、安全性、升级、DFR、压力*

*1.协议、驱动、访问控制、通讯、加密等特性需求，要考虑安全；*

*2.执行表达式和算子类的特性需求，需要考虑性能；*

*3.主备、容灾、存储等的特性需求，需要考虑可靠性；*

*4.外部常用语法、基础功能要考虑增加稳定性用例；*

*5.所有特性均需要考虑可维、可测，可要求研发提供必要的视图。*

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

*测试覆盖策略、自动化看护策略*

*测试框架满足度*

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

*依赖特性识别*

*后续测试详细设计中需要关注的内容*

## Attachments:

[dbms_lob_01.out](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzNhMWFkOWEzMzExZGM4MzIxIiwicmVmX2lkIjoiNjczOTZiNzM3MjgyMDZlZmI5MmYwNjE3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0Mzg4LCJleHAiOjE3ODIzODA3ODh9.SWiQIoD5uyjbS8H_H2hxmXVgUPidjoHq8_bvSxulMkQ)

 (application/octet-stream)    
