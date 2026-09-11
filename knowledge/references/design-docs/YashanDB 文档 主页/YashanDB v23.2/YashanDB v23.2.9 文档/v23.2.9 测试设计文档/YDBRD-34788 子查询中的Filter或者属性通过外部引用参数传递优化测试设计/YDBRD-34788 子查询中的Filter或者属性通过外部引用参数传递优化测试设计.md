# 1. 概述

本文描述 子查询中的Filter或者属性通过外部引用参数传递优化 测试设计。

SR: 

  [YDBRD-34788 - 子查询中的Filter或者属性通过外部引用参数传递优化](https://pingcode.yasdb.com/pjm/items/67203acde489dd086800817b)  

# 2. 需求分析

## 2.1 功能点分析

通过将子查询中的谓词的数据属性向父亲层传递，从而在父亲层查询中扩展更多过滤条件，以减少子查询的执行次数。扩展的谓词包括:

1. **expr is not null;**
1. **expr cmp const;**
1. **expr in/not in const;**


其中，可以用于drvd的子查询有  **in/exists/any子查询。**

部署形式：单机、集群、分布式。

## 2.2 应用场景

针对子查询的优化场景：关联子查询，推导出外部引用相关的属性，可以将属性传递给父查询。

## 2.3 规格约束

1. 不支持传递not in/not exists/all子查询中的数据属性。
1. drvd filter扩展上限为2000个，超过2000个不进行扩展。
1. 扩展谓词仅包含expr is not null/expr in/not in expr const list/expr cmp const。
1. 仅支持对resultOp/scanOp/joinCondOp/viewScanOp上的谓词进行扩展。
1. 子查询表达式不可为复杂表达式，即expr in (expr query + 1)，由于expr query在这种场景下是一个标量子查询，需要通过case when来实现，本需求暂不支持该种扩展。
1. 投影列子查询暂不扩展


## 2.4 目前算子的谓词扩展传递逻辑

注：接口为  sTransError 无需验证。

|算子|接口|说明|
|---|---|---|
|OP_LOGICAL_SELECT|sTransSelect|1. remap子查询drvd上来的optional Filters;
1. 不对drvd prop做任何拦截
|
|OP_LOGICAL_UPDATE|sTransDML|不对drvd prop做任何拦截|
|OP_LOGICAL_DELETE|sTransDML|不对drvd prop做任何拦截|
|OP_LOGICAL_INSERT|sTransDML|不对drvd prop做任何拦截|
|OP_LOGICAL_MERGE|sTransDML|不对drvd prop做任何拦截|
|OP_LOGICAL_SCAN|sTransScan|对scanOp上的谓词做扩展和等价类，加入drvd prop中|
|OP_LOGICAL_IDXSCAN|sTransError|/|
|OP_LOGICAL_JOIN|sTransJoin|1. 对joinCondition上的谓词做扩展
1. outer join/anti join上的join cond的drvd prop不可传给上层，应该直接清空
1. outer join的左右孩子的drvdProp不可传给上层，应该直接清空
|
|OP_LOGICAL_GROUP|sTransGroup|groupingSet时，拦截所有下层算子上的子查询传递上来的传下来的drvdFilters|
|OP_LOGICAL_DISTINCT|sTransUnique|不对drvd prop做任何拦截|
|OP_LOGICAL_AGGR|sTransAggr|拦截所有下层算子传递上来的drvd prop|
|OP_LOGICAL_WINFUNC|sTransWinFunc|不对drvd prop做任何拦截|
|OP_LOGICAL_LIMIT|sTransLimit|不对drvd prop做任何拦截|
|OP_LOGICAL_FOR_UPDATE|sTransPassThru|不对drvd prop做任何拦截|
|OP_LOGICAL_CONNECT_BY|sTransConnectBy|拦截所有下层算子传递上来的drvd prop|
|OP_LOGICAL_UNION|sTransSet|取所有孩子drvdFilters里的公共子集，孩子的|
|OP_LOGICAL_UNIONALL|sTransSet|同上|
|OP_LOGICAL_MINUS|sTransSet|同上|
|OP_LOGICAL_MINUS_ALL|sTransSet|同上|
|OP_LOGICAL_INTERSECT|sTransSet|同上|
|OP_LOGICAL_INTERSECT_ALL|sTransSet|同上|
|OP_LOGICAL_VIEWSCAN|sTransViewScan|1. 集群gv视图或分布式gv视图直接退出，不进viewScan层的递归
1. 对于递归cte，需要清空下层传上来的drvd Filters
1. 其余场景下，不对optional Filters做任何拦截
1. 对viewscanOp上的谓词做扩展，加入drvd filters数组中
|
|OP_LOGICAL_RESULT|sTransResult|对resultOp上的谓词做扩展，加入drvd filters数组中|
|OP_LOGICAL_PROJECT|sTransProject|不对drvd prop做任何拦截|
|OP_LOGICAL_COUNT|sTransCount|不对drvd prop做任何拦截|
|OP_LOGICAL_FIRSTROW|sTransError|/  
|
|OP_LOGICAL_SORTAGGRDIST|sTransError|/|
|OP_LOGICAL_ACSCAN|sTransScan|同scan|
|OP_LOGICAL_EXPAND|sTransError|/  
|
|OP_LOGICAL_TABLE_FUNC_SCAN|sTransScan|同scan|
|OP_LOGICAL_JOINGRAPH|sTransError|/  
|
|OP_LOGICAL_WINPART|sTransError|/  
|


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

主要采用等价类划分、场景法组合进行设计。

1. 需要查询执行计划是否正确扩展谓词。
1. 需要校验查询结果集是否正确。
1. 辅助测试：OPT_FILTER_THRESHOLD 设置为 1，


## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


### 3.2.1 等价类划分

|输入条件|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|
|部署形态|- 单机
- 集群
- 分布式
||||
|表类型|- heap
- lsc
- tac
- view：系统视图、自定义
- dblink表
|表要考虑分区表和未分区，是否有索引(简单覆盖),view:,- 集群gv视图或分布式gv视图直接退出，不进viewScan层的递归
- 对于递归cte，需要清空下层传上来的drvd Filters
- 其余场景下，不对optional Filters做任何拦截
- 对viewscanOp上的谓词做扩展，加入drvd filters数组中
|||
|子查询分类|- exists
- any
- in
||- not exists
- all
- not in
|不支持传递|
|dml分类|- insert
- update
- delete
- select、select ...for update
- merge into
||||
|子查询filter所在位置|- where后
- having后
- on后
||||
|子查询filter是否为等价类|等价类|可以扩展谓词：（例）,- t1.col = t2.col and t2.col = 常量，扩展出t1.col = 常量
- t1.col = t2.col and t2.col > 常量，扩展出t1.col > 常量
- t1.col = t2.col and t2.col >= 常量，扩展出t1.col >= 常量
- t1.col = t2.col and t2.col < 常量，扩展出t1.col < 常量
- t1.col = t2.col and t2.col <= 常量，扩展出t1.col <= 常量
- t1.col = t2.col and t2.col != 常量，扩展出t1.col != 常量
|不等价|不能扩展谓词：（例）,- t1.col != t2.col and t2.col = 常量，不能扩展出 t1.col != 常量
- t1.col > t2.col and t2.col > 常量，不能扩展出 t1.col > 常量
- t1.col < t2.col and t2.col < 常量，不能扩展出 t1.col < 常量
- t1.col < t2.col and t2.col >= 常量，不能扩展出 t1.col >= 常量
- t1.col < t2.col and t2.col <= 常量，不能扩展出 t1.col <= 常量
|
|子查询filter条件表达式|比较运算符：  =、!=、<、>、<=、>= 、  any、some、all|select * from t1 where exists(select * from t2 where t1.col = 1 )|复杂表达式|expr in (expr query + 1)|
||逻辑运算符：  AND、OR、NOT|select * from t1 where exists(select * from t2 where t1.id=t2.id and t2.id =1)|||
||模糊查询：LIKE 、NOT LIKE、RLIKE、NOT RLIKE|select * from t1 where exists(select * from t2 where t1.col like t2.col )|||
||空值检查：IS NULL 、 IS NOT NULL||||
||范围检查：[not]between and 、in/not in、 exists/not exists||||
||伪列：sysdate，  ROWNUM，rowid||||
|子查询filter个数|- 1个
- 2个
- 多个（<10）
- 2000个
- 大于2000个
|filter大于2000个不进行扩展|||
|子查询filter列数据类型|覆盖标量类型,- 数值型
- 字符型
- 布尔型
- 日期时间型
- 大对象型
- bit,raw,json,xmltype
,UDT,- OBJECT
- TABLE
,|- 标量类型：不同/相同数据类型进行等价
- UDT：OBJECT、TABLE类型默认只支持等于、不等于运算，也支持[NOT] IN、IS [NOT] NULL运算。
|||
|select 投影列|- 常量
- 列、伪列
- count(*)
- 普通函数
- 窗口函数
- distinct
||- bool 表达式：执行计划不扩展
- 聚合函数：拦截所有下层算子传递上来的drvd prop
- 子查询
||
|结合其他语法场景|- cte
- 集合：union、union all、  minus、minus all、intersect、intersect all
- join：  inner join、left join、right join、full join
- limit
- group by、grouping sets
- order by 
- 子查询嵌套(三种子查询相互嵌套)
- 绑定参数
|group:,- groupingSet时，拦截所有下层算子上的子查询传递上来的传下来的drvdFilters
,join:,- 对joinCondition上的谓词做扩展
- outer join/anti join上的join cond的drvd prop不可传给上层，应该直接清空
- outer join的左右孩子的drvdProp不可传给上层，应该直接清空
,集合：取所有孩子drvdFilters里的公共子集|- connect by
|- 拦截所有下层算子传递上来的drvd prop
|




### 3.2.2 DFX

|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|否|
|长稳|是|
|一致性|否|
|三方测试工具  
(sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能,优化前,优化后性能对比,CI性能功能不能劣化--赵育，工程能否看护|是|
|可维护性|否|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：



