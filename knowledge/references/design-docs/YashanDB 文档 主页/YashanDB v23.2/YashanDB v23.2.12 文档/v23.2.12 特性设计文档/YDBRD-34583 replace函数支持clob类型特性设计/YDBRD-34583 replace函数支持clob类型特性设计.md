

*SR链接：*  [https://pingcode.yasdb.com/pjm/items/6717aff8e489dd0868fc6d42?](https://pingcode.yasdb.com/pjm/items/6717aff8e489dd0868fc6d42?)  #YDBRD-34583 replace函数支持clob类型



# 1 设计简介

*本文档以replace函数支持clob类型概要设计/需求分析文档作为指导，对YashanDB的replace函数模块进行设计，明确主要的数据结构和主要处理过程，作为后续编码阶段的输入和编码、测试人员的指导。*



# 2 特性概述

 replace支持CLOB数据类型，仅支持单机和集群行表。

# 3 方案分析（可选）

*无*



## 3.1 业内方案分析（可选）

*无*



## 3.2 外部依赖分析（可选）

*无*



# 4 特性设计



## 4.1 总体方案

VERIFY/CONCLUDE放开第一二三个参数对clob/nclob数据类型的拦截，二三个参数在执行阶段会进行到STRING类型的转换（拦截超长LOB）。

加一个anlPatternInLob接口返回字符串在LOB串中第N次出现位置。

## 4.2 功能设计

### 4.2.1 流程设计

verify/conclude：

1、当前第一二三个参数均拦截了lob类型，verify/conclude阶段对三个位置的clob/nclob均放开。

2、当第一个参数类型是CLOB/NCLOB时，函数返回值类型也是对应的CLOB/NCLOB。第二个或第三个参数类型是CLOB/NCLOB时保持原来VARCHAR/NVARCHAR的返回类型（varchar(n)我们的n不对齐）。

3、并在verify结束时判断是否是Lob，是的话需要加上vrfr标志以防止tempLob被静态优化放到context上。

exec：

1、执行阶段第一个参数convert逻辑不变，该是lob就是lob。第二个参数或第三个参数convert要根据目标类型是否是NATIONAL判断转VARCHAR还是NVARCHAR（此处可以对第二三个参数拦截超长LOB）。

2、第二个参数放开lob类型后，会存在isNull=false但是长度为0的lob（比如empty_clob），需要对第二个参数进行空lob识别，如果是空Lob，则不进行模式查找直接返回第一个参数。

3、核心lob replace逻辑：

- 接口anlPatternInLob：CodResult anlPatternInLob(AnlStmt* stmt, Variant*   varLob  , Variant*   pattern  , CodUint64   offset  , CodUint64 nth, CodUint64 patternLen, CodInt64*   posInLob  )，输入想要查找的起始字符偏移数  offset  （有效值从0开始），原始lob，模式字符  串pattern，返回pattern在lob中的字符  偏移（有效值从1开始）
- 上一次的查询结果为prePos，当前的查询结果为curPos，每次查找结束都需要先将从prePos+patternCharLen开始至curPos的部分先拼接到目标数据，然后再将被替换的字符串拼接给目标数据。


### 4.2.2 关键数据结构设计

### 4.2.3 外部依赖接口设计（可选）

## 4.3 非功能性设计

*不涉及*



### 4.3.1 性能设计

*不涉及*



### 4.3.2 安全性设计

当前功能、特性属于普通内置函数范围，不涉及权限控制、加密等场景。

# 5 资料设计

  [REPLACE | YashanDB Doc](https://cod-doc.yasdb.com/yashandb/23.5/zh/Development-Guide/SQL-Reference-Manual/Built-in-Functions/REPLACE.html)  



# 6 自测用例设计

|测试项目||
|---|---|
|大小写||
|national * 非national四种场景覆盖（clob/varchar nclob/nvarchar）||
|长度65534验证||
|列存/分布式拦截验证||
|replace结果超过varchar能承载的范围，和oracle对齐，不再往后替换，并且不报错。,replace（lpad('a',65534,'a'),  'a',   'bb'）;||




# 7 参考资料（非必选）

*无*



# 8 资料模板

|**填写事项**|**功能1**|**功能2**|**......**|
|---|---|---|---|
|用途/规则/运行结果说明|replace一二三个参数都支持clob/nclob，第一参数规格无限制，第二三个参数要求是能转换成string类型的clob/nclob|||
|成功运行前提,权限、参数开关、需要先执行的其他功能等|无|||
|约束限制,支持的部署形态、表形态、长度、类型、大小等|仅支持单机和集群行表。|||
|ebnf/命令格式|replace = REPLACE "(" expr "," search_character [","  replace_character] ")".|||
|选项/参数说明|expr：增加功能支持clob/nclob  
search_character / replace_character：增加功能支持能转换成STRING类型的clob/nclob|||
|例外/异常说明|无|||
|其他说明|无|||


