Created by 周彬鑫, last modified on 六月 25, 2024

# 1. 概述

*SR：*    [https://pingcode.yasdb.com/pjm/items/66192c17fd997db58ad8a633](https://pingcode.yasdb.com/pjm/items/66192c17fd997db58ad8a633)    *?*    
  *#YDBRD-26297 支持information_schema字符集相关系统视图*

*支持information_schema特定的视图&系统表*    
  *CHARACTER_SETS*    
  *COLLATION_CHARACTER_SET_APPLICABILITY*    
  *COLLATIONS*

# 2. 需求分析

## 2.1 功能点分析

- *支持*  *CHARACTER_SETS、COLLATION_CHARACTER_SET_APPLICABILITY、COLLATIONS系统视图*  *  
*


## 2.2 应用场景

- **CHARACTER_SETS表**
- 该CHARACTER_SETS表提供有关可用字符集的信息。该CHARACTER_SETS表包含以下列：
- CHARACTER_SET_NAME #字符集名称。    
  DEFAULT_COLLATE_NAME #字符集的默认排序规则。    
  DESCRIPTION #字符集的描述。    
  MAXLEN #存储一个字符所需的最大字节数。
- **COLLATION_CHARACTER_SET_APPLICABILITY表**
- 该 COLLATION_CHARACTER_SET_APPLICABILITY 表指示什么字符集适用于什么排序规则。该表包含以下列：
- COLLATION_NAME #排序规则名称。    
  CHARACTER_SET_NAME #排序字符集名称
- **COLLATIONS**  **表**
- 该COLLATIONS表提供有关每个字符集的排序规则的信息。    
  该COLLATIONS表包含以下列：
- COLLATION_NAME #排序规则名称。    
  CHARACTER_SET_NAME #排序规则所关联的字符集的名称。    
  ID #整理ID。    
  IS_DEFAULT #排序规则是否是其字符集的默认设置。    
  IS_COMPILED #字符集是否已编译到服务器中。    
  SORTLEN #这与对字符集中表达的字符串进行排序所需的内存量有关。


## 2.3 规格约束

- 目前只支持latin、utf8mb4
- 排序目前只包含general_ci、bin


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*    



- **视图验证**
- **information_schema**
- **查询系统视图**
- **非兼容模式下**


|测试点|等价类|备注|
|---|---|---|
|验证视图字段以及数据是否正确|CHARACTER_SETS|  
|
|  
|COLLATION_CHARACTER_SET_APPLICABILITY|  
|
|  
|COLLATIONS|  
|


|测试点|等价类|备注|
|---|---|---|
|在information_schema下查系统视图|不带information_schema.view|  
|
|  
|带information_schema.view|  
|
|非information_schema下查系统视图|不带information_schema.view|预期报错|
|  
|带information_schema.view|  
|
|创建information_schema下的对象|在information_schema下操作,create table t1(id int)|预期成功（与MYSQL不一致）|
|  
|在其他schema下操作,create table information_schema.t1(id int)|预期成功（与MYSQL不一致）|
|对视图进行DML操作|delete|预期报错|
|  
|update|预期报错|
|  
|insert|预期报错|
|视图查询权限|对齐ALL视图|  
|
|创建同名表/视图|创建  CHARACTER_SETS/COLLATION_CHARACTER_SET_APPLICABILITY/COLLATIONS同名表、视图|预期报错|
|视图同名作别名|表别名、字段别名|  
|


|测试点|等价类|备注|
|---|---|---|
|select语句查询|结合like/not like/group by/order by 语句查询|  
|
|show语句查询|show variables;|不支持|
|  
|show charset;/show character set;|大小写不敏感|
|  
|show collation;|大小写不敏感|
|show与like结合|show charset/collation 结合 like,show charset like '%ascii%';|大小写不敏感|
|show结合where查询|show character set where Charset like 'utf8';|大小写不敏感|
|  
|show character set where Charset = 'utf8';|大小写不敏感|
|关联查询|CHARACTER_SETS、COLLATION_CHARACTER_SET_APPLICABILITY、COLLATIONS|  
|
|拼写错误|字段/视图名拼写错误|查询失败|


|测试点|等价类|备注|
|---|---|---|
|show查询|show variables;|预期报错|
|  
|show charset;/show character set;|预期报错|
|  
|show collation;|预期报错|
|非兼容模式下对应的视图|x$collation、x$charset、v$collation、v$charset|  
|


1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|---|---|
|CT|简单覆盖|
|KT|简单覆盖|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|---|---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

  [详细测试设计文档模板.doc](#)  

## Comments:

|  [](null)  ,会议名称：information_schema字符集视图测试设计评审,评审,评审时间：2024/06/12 11:00-11:30,参与人：刘晓旋、胡晓畔、赵忠源、张鹏飞、林永豪、周彬鑫,1、查询非兼容模式下对应的视图,2、非兼容模式下用show查询,3、information_schema字符集视图权限对齐ALL视图,4、覆盖关联查询、创建同名视图、视图同名做别名、拼写错误,评审结论：通过,Posted by zhoubinxin at 六月 12, 2024 11:38|
|---|
