# 1. 概述

本文描述  gbk\gb18030字符集下使用kmp算法加速filter like的匹配  的测试设计

## 1.1 相关文档

SR:    [https://pingcode.yasdb.com/pjm/items/6765151d64bf5115981872dc?](https://pingcode.yasdb.com/pjm/items/6765151d64bf5115981872dc?)  

#YDBRD-36754 【回合】gbk字符集的filter like谓词支持kmp算法

开发设计文档：  [https://pingcode.yasdb.com/wiki/spaces/ZHONGJINJIAN/pages/673d4ae0593f99c9ff26e259](https://pingcode.yasdb.com/wiki/spaces/ZHONGJINJIAN/pages/673d4ae0593f99c9ff26e259)  

# 2. 需求分析

## 2.1 需求来源及功能点分析

需求来源：  [[SAISSUE-572] 存储过程中的like语法执行效率低导致执行慢无结果 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/SAISSUE-572)  

功能：在GBK\GB18030字符集在filter like的功能无问题

性能：在GBK\GB18030字符集在filter like的性能表现无问题



## 2.3规格约束

- like不能带escape
- like模式串的总长度小于kmp next数组长度（255）


|影响表达式|影响引擎|影响部署形态|出现位置|影响类型|字符集|
|---|---|---|---|---|---|
| like（not like）|单行执行引擎、批量执行引擎|单机、分布式、集群|condition中、投影（布尔表达式）|lob、字符串（varchar\char，nvarchar\nchar）|gbk、gb18030|


# 3. 详细测试设计

## 3.1 测试目标

1. 不能影响原utf8字符集的性能，utf8字符集下带特性的包和基准包相比性能需持平（也包括utf8下nchar和nvarchar性能）
1. 带特性的包在gbk字符集下，需和特性包utf8字符集下的性能持平
1. 带特性的包在gb18030字符集下，需和特性包utf8字符集下的性能持平，且功能用例的结果需正确




## 3.2 详细测试场景

该功能主要是优化gbk/gb18030字符集下like执行

#### 1）功能测试场景

功能：单机已有用例覆盖功能，需在gbk，gb18030字符集下执行，确保结果的准确性

|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|---|---|
|char2字节长度|- 小于255字节
- 等于255字节
- 大于255字节
|大于等于255字节走旧路径|||
|数据类型|- clob/nclob
- nvarchar/nchar
- blob/raw等  **二进制类型**
,（包含yashan模式和mysql模式，字符匹配和字节匹配）|char、varchar已有,修改前和修改后看二进制类型结果是否准确|||
|其他|- gb18030字符部分字节与ascii编码重合
- gbk、gb18030特有字符
||||
||||||




#### 2）性能测试场景

性能：不使用escape的场景，模式串含有通配符：包含‘%（任意个字符）’，‘_(一个字符)’

char1 (not) like char2

表一插入100w行数据，表列包含下述表中所列数据类型，

|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|---|---|
|数据类型|clob/nclob,varchar/char,nvarchar/nchar||||
|通配符% _,（不出现、分别单独出现，组合出现）|数量：,- 一个通配符
- 多个（多个连续，多个不连续）
- 无限制（100个）
||||
||位置：,- 开头
- 中间
- 结尾
||||
||数量与位置交叉测试||||
|char2|- 常量
- 表列
- 表达式
- 除通配符外带有其他字符
||||
|filter|- filter条件and/or组合
- filter在投影列
- filter在where后
- filter后含有其他关键字
||||
|执行方式|非绑定参数,绑定参数：plsql、jdbc||||




*3.3.梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|/|
|KT|/|
|长稳|/|
|一致性|/|
|三方测试工具(sqltest，sqlancer)|/|
|安全|/|
|DFR|/|
|HA|/|
|压力|/|
|性能|是|
|可维护性|/|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


文本用例：

# 5. 测试框架设计

1. 功能测试guider框架已满足


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：

计划测试完成时间：