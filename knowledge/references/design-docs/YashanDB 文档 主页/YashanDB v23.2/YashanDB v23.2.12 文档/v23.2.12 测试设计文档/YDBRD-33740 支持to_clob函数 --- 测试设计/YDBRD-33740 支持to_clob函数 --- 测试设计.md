

# 1. 概述

IR：  [YASHAN-1414](https://pingcode.yasdb.com/ship/ideas/660b7483009f91eb87f2c092?)  #YASHAN-1414  支持to_clob函数

SR：  [https://pingcode.yasdb.com/pjm/items/670736b8e489dd0868f34b9e?](https://pingcode.yasdb.com/pjm/items/670736b8e489dd0868f34b9e?)  #YDBRD-33740 支持to_clob函数

开发调研：  [YDBRD-33740 支持to_clob函数 调研文档 | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67e656652d2effe8fb24eaf6)  

设计设计：  [YDBRD-33740 支持to_clob函数 设计文档 | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67e656852d2effe8fb24eb08)  

测试调研：  [YDBRD-33740 支持to_clob函数-测试调研 | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/HUXIAOPAN/pages/67ea5daa529b5c0231d07fb1)  



# 2. 需求分析

## 2.1 功能点分析

|功能|入参|返回值类型|调研表现|
|---|---|---|---|
|TO_CLOB( {   bfile | blob   } [, csid] [, mime_type] )|blob|CLOB |TO_CLOB (bfile|blob)将 BFILE 或 BLOB 数据根据源字符集转换为数据库字符集，并以 CLOB 值返回。|
|TO_CLOB(lob_column | char)|char、varchar、varchar2、nchar、nvarchar2、raw、clob /nclob|CLOB 或 NCLOB|TO_CLOB (character) 将 LOB 列中的 NCLOB 值或其他字符串转换为 CLOB 值。Oracle 数据库通过将底层 LOB 数据从国家字符集转换为数据库字符集来执行此函数。,在 PL/SQL 包中，可以使用 TO_CLOB（字符）函数将 RAW、CHAR、VARCHAR、VARCHAR2、NCHAR、NVARCHAR2、CLOB 或 NCLOB 值转换为 CLOB 或 NCLOB 值。|


## 2.2 应用场景

函数用于将非 LOB 类型转换为 CLOB 类型 。可使用在  
1、PL/SQL

2、表列

注意：函数表现与”表列“对齐，PLSQL中 BLOB数据使用TO_CLOB( {   bfile | blob   } [, csid] [, mime_type] )函数时，第3个参数仅做语法兼容，实际不生效；



## 2.3 规格约束

（1）TO_CLOB( { bfile | blob } [, csid] [, mime_type] )

|入参|约束||
|---|---|---|
|BLOB|1、bfile 不支持,2、csid：映射yashan支持字符集-->oracle字符集，采用相同csid编号，未识别字符集报错。范围为映射后的字符集ID（浮点型向下取整）,3、mime_type：仅做语法兼容，实际不生效。需覆盖各类型，无core。||




（2）TO_CLOB(lob_column | char)

|入参|约束||
|---|---|---|
|char、varchar、varchar2、nchar、nvarchar2、raw、clob /nclob|入参个数为1，超出报错,入参长度：没有限制，长度限制为类型本身的限制 ,- char/nchar2 : [1,8000]  /  (varchar / varchar2 / nvarchar)[1, 65534] ;   **行存表支持两种长度单位**  ，列存表仅支持字节长度单位
- RAW [1,65534]
||


（3）部署形态

单机&集群  行表  
  分布式 列表  -- 另外IR跟进



# 3. 详细测试设计

## 3.1 测试设计方法

从函数语法和功能出发，覆盖语法路径，结合等价类，边界值，场景法 ，错误猜测法等，输出测试点

## 3.2 详细测试设计

3.2.1 使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式



||**测试场景**|**  
**|**预期**|**备注**|
|---|---|---|---|---|
|函数功能&  语法|参数类型|[PL/SQL] 数值类型：tinyint，smallint，int，bigint、float，double，number）|支持||
|||[PL/SQL] 字符串类型：char，varchar，nchar，nvarchar、varchar2、nvarchar2、raw、clob /nclob|支持||
|||[PL/SQL] 二进制类型：blob|支持||
|||[PL/SQL] 时间类型：date、time、timestamp、interval year to month、interval day to second|支持，interval year to month、interval day to second待测||
|||[PL/SQL] 其他类型：json，xmltype，bit|支持||
|||[PL/SQL] 伪列： rowid rownum rowscn user|支持rowid，其余待测||
||增加UDF场景||||
|||[表列]   **入参为表列（覆盖上述类型）**|支持情况同上||
|||多表关联场景：入参为返回 "字符串/BLOB" 的子查询|支持||
||csid|BLOB类型时，CISD=0 / 可省略|支持||
|||与当前数据库字符集匹配  / 不匹配，  
        DB字符集 ：[ ASCII | ISO88591  |  GBK  |  UTF8  |  GB18030 ]  
        csid取值 ：[ ASCII | ISO88591  |  GBK  |  UTF8  |  GB18030 ]  ,跟进字符集ID映射,YashanDB      <--->       Oracle            <---> csid,ASCII             <---->     US7ASCII         <----> 1,ISO88591      <----> WE8ISO8859P1   <----> 31,GBK               <----> ZHS16GBK          <----> 852,UTF8             <----> AL32UTF8            <----> 873,GB18030       <----> ZHS32GB18030   <----> 854|匹配时，OK,不匹配时，报错、乱码||
|||不存在的字符集ID|报错||
||mime_type|覆盖上述所有类型|不影响函数结果，无core||
||参数检查|1.参数个数  ,TO_CLOB( { bfile | blob } [, csid] [, mime_type] )  ----->  1-3个,TO_CLOB(lob_column | char)   ----->  1个,2.入参为空：  '',3.入参为null,4.入参为常量,5.函数覆盖：名称大小写、拼写错误、名称缺失，带单/双引号|支持||
||函数同名对象| 表，表列，视图，索引等（create view/table/...  as）|支持||
||函数返回值类型|返回CLOB|||
||动态视图看护|视图查询   
v$function、  针对lob视图--无影响|||
|函数应用|DML|函数返回值 insert|支持||
|||函数返回值update set值，where条件|支持||
|||函数返回值 delete|支持||
||与其余内置函数交互|函数返回值作为其他函数入参|支持||
|||其他函数作为当前函数入参|支持||
|||覆盖窗口函数函数|||
||嵌套|127|支持||
|||128|报错||
|||**空lob**  ：嵌套empty_blob / empty_clob  （嵌套测试）|支持||
|||嵌套 to_char，  **字符函数**|支持||
|||嵌套   **返回值为clob/nclob 函数 **|支持||
|||sql绑定|||
||其他场景|insert into  select|支持||
|||子查询|支持||
|||作为 defaule 列|||
|||filter|||
|||group by, order by , limit|||
|||in/not in、exists/not exists 、between and、like/not like|||
||lob 高级包|覆盖：TRIM()、SUB_STR、READ、WRITE、APPEND、WRITEAPPEND|支持||
||入参为多个字符串拼接||||
|性能|入参为大LOB时|512M|||


 

3.2.2 梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式

|系统级DFX分类|是否涉及|
|---|---|
|CT||
|KT||
|长稳||
|一致性||
|三方测试工具(sqltest，sqlancer)||
|安全||
|DFR||
|HA||
|压力||
|性能||
|可维护性||


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

Guider + yasft 

# 6. 测试环境说明

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

VM  CentOS Linux release 7.9.2009  3.10.0-1160.el7.x86_64  

CPU GenuineIntel  Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz

# 7. 工作量评估

工作量：xx人天

计划测试完成时间：