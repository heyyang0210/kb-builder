Created by 李坤宇, last modified on 十月 09, 2024

##   [1. 总述](#1-总述)  

原group by下推方案只支持了当group key、aggr来自join同一边原group by下推方案只支持了当group key、aggr来自join同一边的场景下进行下推场景下进行下推，本方案将扩展下推场景，使group key、aggr将扩展下推场景，使group key、aggr来自join两边自join两边的场景下也场景下也可以下推下推。

###   [1.1 需求来源](#11-需求来源)  

在带group的join场景下，从计划侧提升数据库执行性能。

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=152993908](https://conf.yasdb.com/pages/viewpage.action?pageId=152993908)      
  oracle与我们设计略有不同，详细设计中将展开差异部分。

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|group下推算子改写|见下方详细设计|是|是|
|功能|group下推投影改写|见下方详细设计|是|是|
|性能|支持group下推场景|关注性能|否|是|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|DFX功能1|----|否|否|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

group下推在oracle中叫group by placement    
  有些论文也称之为 eager aggregation

###   [1.5 开源依赖](#15-开源依赖)  

不涉及

##   [2. 接口](#2-接口)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**  SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|语法分支1描述|----|否|
|SQL语法|语法分支2描述|----|否|
|函数|参数/返回值描述|----|否|
|高级包|高级包子对象描述|----|否|
|系统视图|视图域段描述|----|否|
|动态视图|视图域段描述|----|否|
|配置参数|可以通过_OPTMZ_EARLY_GROUP_OPT控制开关|ON/PUSH时启用group下推|是|
|驱动接口|驱动对外提供接口描述|----|否|
|错误码|错误码、ACTION描述|----|否|
|告警|告警描述|----|否|
|日志|日志触发条件、等级、事件描述|----|否|


##   [3. 规格与约束](#3-规格与约束)  

- **下推条件**


1. 聚合函数、group key中都不能有null值敏感表达式
1. 所有聚合函数只能来自于单表
1. group不能推到full outer join之下


- **消去上层group条件**


1. semijoin
1. group双边下推，且joinkey和group key满足条件
1. 外键和主键join


###   [与oracle行为差异](#与oracle行为差异)  

|场景|oracle表现|yashan表现|备注|
|---|---|---|---|
|join条件不为等于|不下退|可以下推||
|hashjoin以外其他类型join|不推|可推||
|多表join|只下推jointree的一层|可能下推到底层|不确定oracle是否是基于cost才下推一层的|
|group key为复合表达式|不推|可推||
|join key为复合表达式|col+const能推，col+col不能推|可推||
|下推计划打印|下推后的group上会有一层view|没有view||


##   [4. 特性](#4-特性)  

###   [4.1 group下推算子改写](#41-group下推算子改写)  

**增加了trans的先序改写逻辑，group改写由内嵌在**  **transGroupExpr**  **改为调用先序改写框架。**    
  **具体改写逻辑如下：**

1. 检查groupkey、aggr是否nullins，如果有nullins则不下退
1. 遍历joinGraph的所有vert，对于每个vert收集其对应的groupkey和aggr
1. 再次遍历所有vert，按照前面收集的groupkey和aggr构造出group算子插入vertOp中。
1. insertgroup，增加下推路径。


- 需要关注对于下推的条件判断是否正确。


###   [4.2 group下推投影改写](#42-group下推投影改写)  

之所以需要投影改写，主要是为了解决以下几个问题：

1. 两阶段聚合改写时，需要保证上下层的aggr正确对齐。生成列计划时的tuple也需要对应上。
1. 对于outerjoin可能产生补空的情况下，需要额外处理才能保证正确性。


**需要处理的场景**

1. aggr无tablebitmap     `count(*)`    场景    
  处理策略：所有下推的group的aggr中都加    `count(*)`  
1. aggr bitmap在下推的bitmap中（单边下推）    
  处理策略：正常下推aggr
1. aggr bitmap不在下推的bitmap中（单边下推）    
  处理策略：下推group中aggr加    `count(*)`  
1. aggr bitmap 在某一边下推的bitmap中（双边下推）    
  处理策略：下推另一边加    `count(*)`  
1. aggr bitmap 不在任何一边下推的bitmap中（双边下推）oracle构造不出来这种场景，因为oracle不会把group推到顶层join之下的join之下。    
  处理策略：所有下推的group的aggr中都加    `count(*)`  


**改写规则如下**

1. 两阶段改写规则


|原始aggr|sum(a)|count(a)|max(a)|min(a)|
|---|---|---|---|---|
|下推的aggr|  `sum(t1.sum(a)*t2.count(*))`  |  `sum(t1.count(a)*t2.count(*))`  |  `max(max(a))`  |  `min(min(a))`  |
|非下推的aggr|  `sum(a *t2.count(*))`  |  `sum(a*t2.count(*))`  |  `max(a)`  |  `min(a)`  |


在outer join场景下，由于存在补空行为，因此一旦将另一侧的    `count(*)`    补空则会导致结果为null，出现错误。    
  因此改写时需要将左右两侧的    `count(*)`    列都补上一个coalesce函数，即上面出现    `count(*)`    处都改为    `coalesce(count(*), 1)`      
  另外，因为    `count(null) = 0`    ,     `sum(null) = null`    , 所以上表中    `count(a)`    匹配聚集列场景时，需要改写为    `sum(coalesce(countA1, 0))`    。coalesce函数也可用ifnull函数，功能上是等价的。

1. join层count改写规则    
  join层的孩子算子分为两类，一类是下方不再有下推后的group，一类是下方有下推后的group。    
  对于有下推后的group的场景，需要增加一个count(1)投影，从上层group开始一路传递到下层group。    
  在join层，当两边都是存在下推group时，join层向上的投影变为两边的count(1)相乘；当只有单边下推时，join层的count(1)对应有下推那边投上来的count(1)。
1. 下推后优化掉上层group的规则    
  优化掉上层group核心是group key的唯一性不会被join破坏。下面简述几种典型场景：


- join是非膨胀型join，即join后不会增长行数，例如innerjoin时joinkey是主键，那么每次最多有一条满足join条件；又例如semijoin，返回非semi边的数据不会增长数据条数。
- group by左右下推，下推后的group key和join key一致，保证join后数据条数不会膨胀。    
  详细设计：


|场景|规则|
|---|---|
||group不能有having|
|group双边下推|1. join条件必须是t1.col=t2.col|
||2. group key必须是join key中的col,因为等价类优化，group key可以是任何一个col或两个都有|
||3. 只能是inner join|
|semi/antijoin|1. group必须至少下推到非semi边，即leftjoin的左边，rightjoin的右表|
||2. 下推到join之下的group的groupkey与原groupkey相同|
||3. 下推的group必须是顶层的join的直接孩子，中间不能再有join|
|主外键关联等唯一性情况（此版本暂不支持 后续keycons完善后适配）|1. join条件必须是t1.col = t2.col 且t1.col是外键t2.col是对应的主键|
||2. 下推到join之下的group的groupkey与原groupkey相同|
||3. 下推的group必须是顶层的join的直接孩子，中间不能再有join|


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 下推是否满足条件
1. 关注aggr(const）、aggr（param)等情况
1. 多种join类型 outer、inner、semi等


自测用例设计方法：

1. group key维度： group key来自单边、group key来自两边、groupkey来自多边（大于2表时）；joinkey包含group key/不包含group key
1. aggr维度：基础aggr(min/max/sum/count)，其他aggr(avg/方差/listagg?等)，注意测试聚合函数参数为列/*/常数/null时的结果正确性。
1. 构造满足优化上层group的用例
1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Comments:

|  [](null)  ,涉及复合表达式的场景，可以使用支持计算统计信息的复合表达式,Posted by mawenying at 七月 04, 2024 11:28|
|---|
