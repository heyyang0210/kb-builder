Created by 谭思宇 on 一月 19, 2024

* IR链接：*    [YDBRD-12117](https://jira.yasdb.com/browse/YDBRD-12117?src=confmacro)    *-*  *算子路径添加复制执行路径*  *完成*

*SR链接：*    [YDBRD-13990](https://jira.yasdb.com/browse/YDBRD-13990?src=confmacro)    *-*  *物化使用rescan标志来生成*  *冒烟测试*

##   [1. 总述](#1-总述)  

rescan指的是对某个算子进行重新扫描，在部分场景下，某些算子所处的子树需要被多次执行，若第二次被执行时所得到的数据不会发生变动，则该部分行为被称为rescan。

###   [1.1 需求来源](#11-需求来源)  

从执行层面来看，在实际执行时，由于某些算子进行物化之类的操作时会持续占用执行资源，而由于执行器无法得知某个算子是否需要重新执行，执行器本身并不知道资源释放的时间点，  **如果优化器能够给出某些算子是否需要rescan，执行器便能够基于此判断出是否能够释放执行资源**  。

从优化层面来看，  **当前优化器中对于rescan的处理并不统一且生成rescan需求的算子也并不明确**  ，在分布式场景下会出现物化算子添加到无效甚至是错误位置导致执行错误，需要对rescan进行统一的梳理。

###   [1.2 调研文档](#12-调研文档)  

--

###   [1.3 需求分析](#13-需求分析)  

本需求重点的关注场景在于几个问题

- rescan在什么场景下产生？
- rescan如何让执行感知？
- rescan如何在优化器内部   **正确地**   传递？


|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|**计划增加rescan标记**|将原先只在optimize阶段使用的rescan传到createPlan阶段|是|是|
|功能|**rescan传递逻辑重整**|将rescan的需求通过require和derive框架初始化并传递，该传递依赖算子的引用标记|是|是|
|功能|**分布式外部引用场景分布属性继承调整**|分布式下子查询中对于父查询的继承跟随子树引用标记进行继承|是|是|
|性能|性能场景1|----|否|否|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|保证旧有场景不受影响，调整分布式下关联子查询场景的正确性|----|否|是|
|安全|----|----|否|否|
|易用性|----|----|否|否|
|可修改性|需要保证新的rescan传递的可读性与可维护性|----|否|是|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|rescan|对于某个算子的重扫|-||
|require|算子对从孩子接收来的数据的数据特征要求|-|-|
|derive|物理算子产生的数据特征|-|-|
|param|绑定参数，包括外部引用|-|-|


##   [2. 接口](#2-接口)  

**重构不对外感知**

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|语法分支1描述|----|否|
|SQL语法|语法分支2描述|----|否|
|函数|参数/返回值描述|----|否|
|高级包|高级包子对象描述|----|否|
|系统视图|视图域段描述|----|否|
|动态视图|视图域段描述|----|否|
|配置参数|配置参数作用、生效方式|----|否|
|驱动接口|驱动对外提供接口描述|----|否|
|错误码|错误码、ACTION描述|----|否|
|告警|告警描述|----|否|
|日志|日志触发条件、等级、事件描述|----|否|


##   [3. 规格与约束](#3-规格与约束)  

计划的规格基本由执行的未支持特性导致，例如

- 计划中的外部引用的使用点与外部引用的提供点必须在同样的设备（即CN或DN）且其中不能有PX，该限制的原因是分布式下执行要求外部引用的提供与使用在同一stage中
- 关联子查询不支持并行等


##   [4. 特性](#4-特性)  

###   [4.1 Rescan逻辑重整](#41-rescan逻辑重整)  

####   [4.1.1 调整Rescan和Restore的描述，增加ref信息以实现对分布式的支持。](#411-调整rescan和restore的描述增加ref信息以实现对分布式的支持)  

```
typedef enum EnRescanType {
	RS_NONE, 
	RS_RESCAN,
	RS_RESTORE,
} RescanType;

```

增加ParamType，分别代表sql语句的外部输入参数，subq的外部引用和correlated join左边子树引用右边子树的场景。

```
typedef enum EnParamType {
	PARAM_NONE,
	PARAM_JOIN,
	PARAM_SUBQ,
	PARAM_QUERY,   //SQL 语句级别的输入参数，对rescan部分无任何影响。
} ParamType;

```

```
typedef struct StRescanDesc {
	RescanType   rescan;
	ParamType    paramType;   //标志外部引用的类型。
	CodUint8     unused[2];
} RescanDesc;

```

**描述解释**  ：

**RescanDesc**  ：为ExtraProp中的成员，用于描述rescan属性，若某一个算子向下的require中包含了RescanDesc时，其应该解读为：当前算子本身需要对下方算子进行多次扫描。

当在derive中出现时，表示当前算子支持的重扫类型，RS_NONE表示当前算子不支持重扫，即重扫会导致结果不同，RS_RESCAN表示当前算子支持重扫，RS_RSTORE表示当前算子支持从上次扫描的位置开始重扫（预留）。

**paramType**  ：类型为子查询和Nestloop引用。    
  1、分布式下保证外部引用的提供点和使用点在一个stage中实现。    
  2、外部引用保证物化的添加是正确的。

Require：标志这个require的儿子存在外部引用。（关联子查询，nestloop join右儿子）    
  Derived：记录了从计划树的最下层节点到当前阶段的这段子树上，是否包含外部引用的信息。

####   [4.1.2 调整JoinFlag](#412-调整joinflag)  

增加isCorrelated标志，该标志表示join的右子树会引用左子树的信息，为后续将子查询转化为Join服务，同时根据此标志，确定Required的ParamType。需要将这个标志位赋值正确。实现一个是否Correlated join的函数，输入为join，输出为CodBool类型。

```
typedef union UnJoinFlag {
    CodUint16 flag;
    struct {
        CodUint8 isInner : 1;
        CodUint8 isCross : 1;
        CodUint8 isOuter : 1;
        CodUint8 isSemi : 1;
        CodUint8 isAnti : 1;
        CodUint8 isLeft : 1;
        CodUint8 isRight : 1;
        CodUint8 isFull : 1;
        CodUint8 isNotIn : 1;
        CodUint8 isCorrelated : 1;
        CodUint8 unused : 6;
    };
} JoinFlag;

```

####   [4.1.3 Required设计](#413-required设计)  

#####   [Rescan 的产生：](#rescan-的产生)  

1、子查询，Rescan设置为Rescan，如果是关联子查询，require的paramType设置子查询。    
  2、Nestedloop join的右子树，Rescan设置为True。如果是correlated join，require的paramType设置为Join.

#####   [Restore的产生：](#restore的产生)  

Merge sort join的两个子树。

Require和关系产生，因为restore可以满足rescan，产生的rescan需求取需求中较大的。

|上层 \ 本层|None|Rescan|Restore|
|---|---|---|---|
|None|None|Rescan|Restore|
|Rescan|Rescan|Rescan|Restore|
|Restore|Restore|Restore|Restore|


paramType：

|上层 \ 本层|None|param_join|param_subq|
|---|---|---|---|
|None|None|param_join|param_subq|
|param_join|param_join|param_join|param_subq|
|param_subq|param_subq|param_subq|param_subq|


####   [4.1.4 Derived设计](#414-derived设计)  

//待补充，各个算子补充。scan注意，各种不同scan，产生的required是不一样的。    
  Table Full/Index Scan：产生Rescan， restore目前尚未支持。    
  TableFunc scan：如果函数是稳态的，产生Rescan，否则产生None。表函数derive的可以是任何节点。CN也可以。    
  DBLink表，外部表：None

####   [4.1.5 Satisfied处理](#415-satisfied处理)  

可以满足rescan的算子：比如物化算子

|满足关系|derived None|derived Param|
|---|---|---|
|required None|T|T|
|required Param|T|F*|


F*：False，但不能直接添加物化，通过将物化下传给儿子层来实现。

满足Rescan关系的算子，如果下层derive上来的引用，则满足，如果有引用，则不满足，在这种不满足的情况下，不可以添加物化，需要将rescan的需求直接传递给下层，通过下层来实现。

直接PassThrough的算子无影响。

###   [4.2 分布式关联子查询属性继承调整](#42-分布式关联子查询属性继承调整)  

当前分布式场景下，外部引用的提供点与使用点要求在同一个设备上进行，并且要求不跨stage，即从子查询入口，到这个外部引用被执行的点为止，中间不能存在任何的PX。

因此从子查询入口开始直到绑定参数的执行节点，其所有的节点必须保持与入口分布属性一致（当前关联子查询仍未支持在DN上执行，因此实际上需要使用点以上的所有节点都在CN执行）

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。