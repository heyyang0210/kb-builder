Created by 何阳, last modified on 九月 12, 2024

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf3b](https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf3b)    *?*    
  *#YASHAN-1071 Runtime Filter增强*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/662632c7fd997db58adefaf3](https://pingcode.yasdb.com/pjm/items/662632c7fd997db58adefaf3)    *?*    
  *#YDBRD-26582 Runtime Filter增强*

  


*---------------以下为正文开始分隔线-----------------*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

  


**基本概念介绍：**

runtime filter是指在查询过程中动态地对数据进行过滤，减少扫描的数据量，减少网络传输以及IO，是一种常用的加速查询手段。

   适用的场景为，大表join小表，先扫描小表的数据，根据小表的数据特征，通过特定算法生成动态的filter条件，然后下推到大表上，进行数据过滤，减少大表的IO，过滤数据。

示例

```
create table t1(r1 int, r2 int);
create table t2(r1 int, r2 int);
​
select * from t1, t2 where t1.r1 = t2.r2 and t2.r1 = 4;
```

  


  


大表join小表，下表T1和T2数据分别为10 0000,2000，一般将左表称为probe表，右表为build表

  


```
|          >      HashJoin          <
|         |                         |
|         | 100000                  | 2000
|         |                         |
|        Scan                            Scan
|         ^                         ^   
|         | 200000                  | 2000
|        T1                        T2
|
```

  


扫描方式

- 方式1：T1和T2表分开扫描，然后再做join，时间瓶颈在T1的扫描时间
- 方式2：T2先扫描，根据T2的数据得到一个过滤条件，然后T1表拿到这个过滤条件再去扫描，扫描总时间 = T2扫描 + 带filter的T1扫描时间


其中生成的过滤条件就是Runtime filter。

   runtime filter有多种类型，有  **bloom**  ，MinMAx，  **IN predicate**  ，IN OR Bloom ，BitMap

   处理数据得到的过滤条件，不同的算法过滤效果不一样，所以对不同的数据特点，选择一个合适的算法非常重要，关系到整体扫描时间。

  


### Bloom filter

(布隆过滤器)[    [https://developer.aliyun.com/article/773205](https://developer.aliyun.com/article/773205)    ]

最初设计的目的：判断一个元素是否在一个集合中。有多种数据结构可以用来存储集合数据，比如链表，树，哈希表等，这几个结构的缺点是，随着数据量增加，存储空间越来越大，检索速度也随着数据量增长而降低。

Bloom Filter的数据结构为一个固定大小的二进制向量和一系列映射函数组成，映射函数本质就是散列函数。

**变量加入集合步骤**

1. 将位图初始化为0
1. 变量加入到集合
1. 调用N个映射函数，映射成位图中的N个点，将其位置置为1 --- 存在的问题：不同的变量，可能会映射到同一个位，将其置为1，因此在位图中对应位的值为1，不表示这个变量一定在这个集合中。


**查询变量是否存在**

1. 将查询元素经过N个映射函数，得到N个位置
1. 如果这N个位置有一个为0，则不在集合中，否则可能存在集合中


|名称|优点|缺点|
|:---|:---|:---|
|Bloom Filter|所需存储空间小，查询/插入复杂度为O(n)，n为映射函数数量|无法准确判断数据是否在集合中，容易误判|


  


runtime filter类型

- LOCAL：   构建的Runtime Filter只能在同一个实例上
- GLOBAL 跨节点，通过网络传输到不同的DN节点上 
- Part：多个Part runtime filter组成Global Runtime filter，不同DN节点上的Part Runtime Filter汇总到一个节点上，成为一个Global Runtime Filter，然后过滤数据


### 三种场景 逻辑图见链接：

- 单机并行 图： 
- Hash join在CN，Build表构建的就是Global Runtime filter，不需要进行汇总 图：
- Hash join在DN，Build表构建的为Part Runtime filter 图：


  


###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

**需求来源于嘉实基金，为了进一步提升分布式下runtime filter的能力，加速查询。**

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

**概述**     友商相似需求的实现情况，详细调研在在调研文档中展开，要体现调研要素的全面，由另一个文档阐述。为了避免头重脚轻，调研不用在本文档展开。

*可以在这个章节从功能、性能等各维度比对友商方案，以及我们的设计方案。*

  


- Ob 计划，计划上build和probe显示跟anchorbase是反的，


- starrocks跟anchorbase是一致的，不支持将Runtime Filter下推到left outer、full outer、anti join的左表；


- Oracle没有明确的runtime filter概念，是通过嵌套join方式来实现相同的效果的


###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

**链接： **    [Runtime](https://conf.yasdb.com/pages/viewpage.action?pageId=156111757)      [ Filter增强](https://conf.yasdb.com/pages/viewpage.action?pageId=156111757)      [需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=156111757)  

  


|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|分布式支持runtime filter|  [YDBRD-8125 : Dstb Runtime Filter Design（分布式Runtime Filter方案设计）](107381981.html)  |是|是|
|性能|谓词列传导|  
|是|是|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|DFX功能1|----|否|否|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|否|否|
|周边配合|审计|----|否|否|
|周边配合|导入导出工具|----|否|否|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|runtime filter|旨在为某些 Join 查询在运行时动态生成过滤条件，来减少扫描的数据量，避免不必要的I/O和网络传输，从而加速查询|是|  [doris runtime filter](https://doris.apache.org/zh-CN/docs/1.2/query-acceleration/join-optimization/runtime-filter/)  |
|Bloom Filter|布隆过滤器是一种空间高效的概率数据结构，用于检测元素是否为集合的成员|是|  [Bloom Filters – Introduction and Implementation](https://www.geeksforgeeks.org/bloom-filters-introduction-and-python-implementation/)  |


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无依赖的开源组件

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|SQL语法|语法分支1描述|----|是/否|
|SQL语法|语法分支2描述|----|是/否|
|函数|参数/返回值描述|----|是/否|
|高级包|高级包子对象描述|----|是/否|
|系统视图|视图域段描述|----|是/否|
|动态视图|视图域段描述|----|是/否|
|配置参数|配置参数作用、生效方式|----|是/否|
|驱动接口|驱动对外提供接口描述|----|是/否|
|错误码|错误码、ACTION描述|----|是/否|
|告警|告警描述|----|是/否|
|日志|日志触发条件、等级、事件描述|----|是/否|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

1. probe表侧 ，下推到rescan算子截止，不能往下推，在执行上已经做了拦截


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

**从IR层级架构方案设计的说明，要呼应1.4章节需求描述中，对特性交付的质量属性详细展开。**     针对功能、性能、可用性、可靠性、可维可测等各维度实现时，关键技术点（技术方案、技术难点、技术风险）的展开。

*关键技术点展开要借鉴结构化分析或者UML工具，设计方案优选用图，要求如下（理论指导的斜体内容在正式文档可以直接删除）*     各图如何画可以用参照链接       [https://conf.yasdb.com/pages/viewpage.action?pageId=135603021](https://conf.yasdb.com/pages/viewpage.action?pageId=135603021)  

*1）结构化设计方法：数据流图 + 状态转换图 + ER图*

*2）UML工具呈现4+1视角*

```
用例视图：用例图（通过 场景描述，以及对应场景下的设计方案，也可以直接用例描述）

逻辑视图：类图<span class="hljs-regexp" style="color: rgb(188,96,96);">/对象图/</span>构件图/包图（特性下各模块的分工配合）

实现视图<span class="hljs-regexp" style="color: rgb(188,96,96);">/进程视图：顺序图/</span>活动图<span class="hljs-regexp" style="color: rgb(188,96,96);">/状态图/</span>定时图（详细设计文档更为关注、概要设计多为特性框架视角）

部署视角：部署图 （子特性不涉及，总体设计文档涉及）

```

**图为工具也是编码的抽象，便于项目干系人（TL/SE/PL/MDE/开发人员）理解特性的实现方案原理。**

###   [4.1 特性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

![](https://pingcode.yasdb.com/atlas/files/public/67396e01a1ad9a3311dc94b0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM1MjQsImV4cCI6MTc4MjMyNDMyNH0.ya-3KHP5ZVpcYvMMhNmF1suekvJ29EghCHdRuLOhdj4)

  


**createRuntimeFilters没有足够的probe Expr来去生成runtime filter，进一步的原因是addFilter2EqClass函数优化掉了等价的join表达式**

  


```
// 1.静态优化阶段，根据join condition去构建出EqClass出来  --- 主要处理函数：buildJoinGraphByOp
// 2.transform 阶段的逻辑转逻辑阶段，根据不同的join order，去构建新的join condition  --- 主要处理函数 mergeJoinFilter
// 3.transform 阶段的逻辑转物理阶段，根据JoinDesc的condition去生成左右表达式数组--- 主要处理函数 extraJoinKeys
// 4.在extract阶段，增加runtime filter算子 --- 主要处理函数 addRuntimeOp
 

CodResult buildJoinGraphByOp(CboOptimizer* cboOpt, SelectDesc* select, CboOperator* cboOp, JoinGraph* joinGraph)
{
	// 1.根据JoinDesc->joinCond和JoinGraph去生成inner join的Filter
    // 2.优化inner join的Filter得到Filter的数组
    // 3.然后根据Filter数据组 构建EqClass 和 JoinEdge
}

static inline CodResult mergeJoinFilter(MemoryContext* mctx, EqClass* eqClass, ObjectArray* joinEdges,CodHashMap* disjointSet, CboOperator* vertexOp)
{
    // 1.非inner join时，返回
    // 根据JoinEdge和EqClass去生成新的join condition
}

static CodResult extraJoinKeys(MemoryContext* mctx, AnlTableBitmap* leftBitmap, Filter* joinCond, ObjectArray** lExprs, ObjectArray** rExprs, CodUint8* filterType)
{
    // 1.根据joinCond生成 leftExprs和rightExprs
    // 2.根据join key，去做cast类型转换  optmzAdjustCmpType
}

// 类型转换处理  优化器类型不一致，增加cast处理逻辑
CodResult optmzAdjustCmpType(MemoryContext* mctx, Expr** buildExpr, Expr** probeExpr)
{
    // 1.DataType 一致直接返回
    // 2.DType_BIT特殊处理，单独分支，如果是左右其中一个为DType_BIT，判断是否可以做隐式转换，
		// 2.1 string 类型，都CAST转为DTYPE_NUMBER 
   		// 2.2 DTYPE_BOOL ~ DTYPE_UBIGINT 都CAST转为DTYPE_BIGINT
 		// 2.3 左右转换为buildExpr或者probeExpr的类型
	// 3.生成target Datatype类型（DTYPE_CHAR,DTYPE_RAW）或者 （DTYPE_RAW,DTYPE_CHAR），目标类型为DTYPE_VARCHAR，否则以build侧为准
    // 4.根据target 数据类型，检验build，probe两侧表达式是否跟target类型可以做转换   具体转换可以参考：https://conf.yasdb.com/pages/viewpage.action?pageId=76928667
   	// 5. 将build和prob侧的表达式，加cast转为target类型

    // 6.number类型特殊处理，左右两边都为number类型，precision和scale不是完全一致，左右两边都将precision，scale提升为(38, 128)   
	// 7.numberic_flocat特殊处理，左右两边任意为numberic_float，将左右直接改为number类型，precision，scale改为(38, 128)
}


static CodResult addRuntimeOp(ExtractContext* ctx, CboOperator* joinOp)
{
    // 1. create FilterNodes ObjectArray. ---  createRuntimeFilters
    // 2. 创建 join filter Create算子
    // 3. 创建 join filter use算子
	/*
	 * 4.根据joinDesc的左右表达式，跟下层算子进行比对，扩展出新的runtime filter  expandRuntimeFilter
     */
    // 5. 下推runtime filters   --- tryPushRtFilter
    // 6. 将runtime filter数组转换为tree结构

}

CodResult expandRuntimeFilter(ExtractContext* ctx, CboOperator* parentOp, CboOperator* cboOp, ObjectArray* userFilters, ObjectArray* createFilters)
{
	/*
	 * 1.不满足下推，直接返回 isNotPushDownOp
	 * 2.viewOp && 不是集合Op，继续遍历子树
	 * 3.Scan算子，直接返回
	 * 4.Join算子，尝试增加runtime filter  tryMakeBinRuntimeFilter
	 * 5.其他算子，isNotPushDownOp
	 */
}

CodResult tryMakeBinRuntimeFilter(ExtractContext* ctx, CboOperator* parentOp, CboOperator* cboOp,
                               ObjectArray* userFilters, ObjectArray* createFilters)
{	
	/*
	 * 1.将上层的左右表达式跟下层的左右表达式做比对，遍历左右表达式数组
	 * 1.1 如果isSameExpr，表达式相同，就产生新的表达式数组
	 * 2.根据新生成的表达式数组，调用createRuntimeFilter，去生成新的runtime filter出来
	 * 3.继续遍历左子树算子树，尝试增加runtime filter
	 */
}

// 根据JoinDesc上的左右表达式数组，去生成runtime filter
static CodResult createRuntimeFilters(ExtractContext* ctx, CboOperator* joinOp, ObjectArray** pUseFilters, ObjectArray** pCreateFilters)
{
    // 1.获取left operator信息

	// 2.根据left operator生成tableBitMap

    // 3.根据probeExpr去生成runtime filter  ---- 当前是probeExpr在addFilter2EqClass的时候，被优化了，导致没有生成出对应的runtime filter
}

static inline CodBool isNotPushDownOp(CboOperator* cboOp)
{
    return isSetOp(cboOp) || isConnectByOp(cboOp) || isLimitOffsetOp(cboOp) || isCountOp(cboOp) || isWinFuncOp(cboOp) ||
           isFirstRowOp(cboOp);
}

static CodResult tryPushRtFilter(ExtractContext* ctx, CboOperator* cboOp, FilterNode** pRtNode)
{
    // 1.判断是否满足下推条件，不满足直接返回 isNotPushDownOp(op) || pRtNode == NULL
    
    // 2.如果是viewScan并且不是集合算子，继续尝试下推   ----  tryPushRtFilter2ScanOp
    // 3.如果是Scan算子，下推runtime filter
    
    // 4.如果是二元操作算子，继续尝试下推
    
    // 5.其他情况，尝试下推
}

static CodResult tryPushRtFilter2ScanOp(ExtractContext* ctx, CboOperator* cboOp, FilterNode** pRtNode)
{
    // 1.获取filter和table出来
    
    // 2.检查runtime filter是否满足下推
}
```

```
// 1. buildJoinGraphByOp  构建join EqClass
buildEqClass  
buildJoinGraphByOp cbo_joingraph.c:569
transJoinOp2GraphOp trans_join.c:1056
transJoin2JoinGraph trans_join.c:1115
transJoin2JoinGraph trans_join.c:1113
transJoin2JoinGraph trans_join.c:1113
transJoin2JoinGraph trans_join.c:1111
staticTransJoin2GraphOp cbo_optimizer.c:935
staticTransFinalPhase cbo_optimizer.c:948
staticTransform cbo_optimizer.c:1008
cboOptimize cbo_optimizer.c:1022
anlCreatePlan anl_plan.c:181
adoCreatePlan ado_plan.c:38
doParseDML anl_parser.c:1777
parseDML anl_parser.c:1845
parseExplain anl_parser.c:1948
doAnlParse anl_parser.c:2048
anlParse anl_parser.c:2084
doAnlPrepare2 anl_stmt.c:1554
anlPrepare2 anl_stmt.c:1570
doDirectExecute anr_service.c:3011
anrDirectExecute anr_service.c:3083
anrResponse anr_service.c:4326
anrResponseTask anr_service.c:4846
workerRunTask ani_worker_pool.c:193
workerProc ani_worker_pool.c:310
threadProc ani_thread.c:293
start_thread 0x00007f5ea3f50ea5
clone 0x00007f5ea3c799fd
    
    
// 2. mergeJoinFilter transform阶段的逻辑转逻辑阶段 判断filter是否等价  
isFilterSameEqClass cbo_eqclass.c:114
hasEqFilter cbo_eqclass.c:277
mergeJoinFilter joinorder_dp.c:184   //  构建joinCond
computeJoinVertexCost joinorder_dp.c:227
searchDpJoinOrders joinorder_dp.c:568
searchDpTopOrders joinorder_dp.c:626
optmzJoinOrder joinorder_dp.c:874
txformLogiGraph2LogiJoin trans_join.c:869
applyTransforms cbo_engine.c:112
transGroupExpr cbo_engine.c:320
transGroup cbo_engine.c:419
transGroupExpr cbo_engine.c:310
transGroup cbo_engine.c:419
transGroupExpr cbo_engine.c:310
transGroup cbo_engine.c:419
transGroupExpr cbo_engine.c:310
transGroup cbo_engine.c:419
transGroups cbo_engine.c:970
transform cbo_engine.c:1005
cboOptimize cbo_optimizer.c:1027
anlCreatePlan anl_plan.c:181
adoCreatePlan ado_plan.c:38
doParseDML anl_parser.c:1777
parseDML anl_parser.c:1845
parseExplain anl_parser.c:1948
doAnlParse anl_parser.c:2048
anlParse anl_parser.c:2084
doAnlPrepare2 anl_stmt.c:1554
anlPrepare2 anl_stmt.c:1570
doDirectExecute anr_service.c:3011
anrDirectExecute anr_service.c:3083
anrResponse anr_service.c:4326
anrResponseTask anr_service.c:4846
workerRunTask ani_worker_pool.c:193
workerProc ani_worker_pool.c:310
threadProc ani_thread.c:293
start_thread 0x00007f5ea3f50ea5
clone 0x00007f5ea3c799fd
    
// 3. transform 阶段的逻辑转物理阶段   extraJoinKeys  
extraJoinKeys trans_join.c:994
transLogi2PhysJoin trans_join.c:1029
applyTransforms cbo_engine.c:112
transGroupExpr cbo_engine.c:320
transGroup cbo_engine.c:419
transGroupExpr cbo_engine.c:310
transGroup cbo_engine.c:419
transGroupExpr cbo_engine.c:310
transGroup cbo_engine.c:419
transGroupExpr cbo_engine.c:310
transGroup cbo_engine.c:419
transGroups cbo_engine.c:976
transform cbo_engine.c:1010
cboOptimize cbo_optimizer.c:1094
anlCreatePlan anl_plan.c:183
adoCreatePlan ado_plan.c:38
doParseDML anl_parser.c:1777
parseDML anl_parser.c:1845
parseExplain anl_parser.c:1947
doAnlParse anl_parser.c:2047
anlParse anl_parser.c:2083
doAnlPrepare2 anl_stmt.c:1561
anlPrepare2 anl_stmt.c:1578
doDirectExecute anr_service.c:3031
anrDirectExecute anr_service.c:3110
anrResponse anr_service.c:4362
anrResponseTask anr_service.c:4889
workerRunTask ani_worker_pool.c:193
workerProc ani_worker_pool.c:310
threadProc ani_thread.c:293
start_thread 0x00007efe001b2ea5
clone 0x00007efdffedb9fd

// 4.增加runtime算子
addRuntimeOp cbo_runtimefilter.c:527
tryAddRuntimeOp cbo_runtimefilter.c:575
extractBestOp cbo_engine.c:938
extractBestOp cbo_engine.c:924
extractBestOp cbo_engine.c:947
extractBestOp cbo_engine.c:947
extractBestOp cbo_engine.c:947
extractBestOp cbo_engine.c:947
extractBestOp cbo_engine.c:947
extract cbo_engine.c:1059
cboOptimize cbo_optimizer.c:1101
anlCreatePlan anl_plan.c:183
adoCreatePlan ado_plan.c:38
doParseDML anl_parser.c:1777
parseDML anl_parser.c:1845
parseExplain anl_parser.c:1947
doAnlParse anl_parser.c:2047
anlParse anl_parser.c:2083
doAnlPrepare2 anl_stmt.c:1561
anlPrepare2 anl_stmt.c:1578
doDirectExecute anr_service.c:3031
anrDirectExecute anr_service.c:3110
anrResponse anr_service.c:4362
anrResponseTask anr_service.c:4889
workerRunTask ani_worker_pool.c:193
workerProc ani_worker_pool.c:310
threadProc ani_thread.c:293
start_thread 0x00007efe001b2ea5
clone 0x00007efdffedb9fd
```

### Runtime Filter节点间分发

可以参考文档：    [YDBRD-8125 : Dstb Runtime Filter Design（分布式Runtime Filter方案设计）](107381981.html)  

关键问题：

1. 确定哪些场景需要进行分发？  — 当前SR不涉及修改
1. 关键数据结构是什么，网络处理流程？  — 当前SR不涉及修改


  


#### runtime filter消息发送 & 返回ack

通信消息类型：DPH_CMD_RUNTIME_FILTER

ICS处理接口函数：gAndMsgProcessor

    现有runtime filter消息在recv线程处理，入口全局结构体：gNetMsgProc

```
// ics recv线程处理，ics recv线程处理只能处理轻量任务
CodResult anrProcNetMsg(AndInstance* inst, IcsMsgHead* head, IcsLinkReader* reader)
{
    // 1.根据sid得到handler
    // 2.不同的msg处理函数进行处理
}

// 处理runtime filter消息入口函数
CodVoid andProcRuntimeFilterMsg(AnlHandler* handler, IcsMsgHead* head, IcsLinkReader* reader, DstbMsgVersion* ver)
{
   // 1.merge_runtime filter

   // 2.生成runtime filter msg node，放入到ctrlMgr的handler队列，然后ctrlProc处理函数，取消息发送runtime filter ack消息
}
```

  


#### 等待多个runtime filter

列执行中，生成runtime filter的处理函数create_runtime_filter

```
/*
 * crab仓
 */
struct HashJoinCursor;

fn create_runtime_filter(&mut self) -> Result<()> {
 // 1.遍历build table上的runtime filter
 // 2. 判断是否需要分发 或者 需要合并
 // 2.1  如果不需要，则生成local runtime filter 返回
 // 2.2  如果需要，则根据runtime filter下标拿runtime filter，然后merge，生成RuntimeFilter对象返回
}



/*
 * anchorbase 仓
 */

// anchorbase仓 等待多个runtime filter
fn wait_global_runtime_filter(&mut self) -> Result<()> {
 // 1.判断是否需要等待，不满足条件，直接返回
 // 2. loop
}

fn transform_hash_join_plan_with_childs<Builder: LogicalPlanBuilder>(
    hash_join_plan: &AnchorHashJoin,
    build: Box<dyn Operator>,
    probe: Box<dyn Operator>,
    redistributed_state: RedistributedState,
    need_merge: bool,
    runtime_filter: Option<CodVec<TransformedRuntimeFilter>>,
    context: &mut PlanContext<Builder>,
    stmt: &Statement,
    tracer: Option<Box<dyn TraceOutput>>,
    old_refer_param_num: usize,
    old_param: CodVec<usize>,
) -> Result<Box<dyn Operator>> {
    // 1.得到build_keys 和probe_keys
 	// 2.根据probe type和build tpye做类型提升 参考规则：https://conf.yasdb.com/pages/viewpage.action?pageId=100074395
	// 3.transform_hash_join_runtime_filter
	// 4.待补充...
}


fn transform_hash_join_runtime_filter(
    alloc: StdAlloc,
    join_keys: &[Box<dyn Expression>],
    runtime_filters: Option<CodVec<TransformedRuntimeFilter>>,
    distinct_rows: usize,
    parallel_num: usize,
    need_merge: bool,
    use_precise_rows: bool,
    build_schema: &Arc<Schema>,
    thread_depend: bool,
) -> Result<Option<Arc<CodVec<RuntimeFilterInfo>>>> {
	// 1.
}
```

Crab列提升规则：    [Hash join分发key类型提升规则 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=100074395)  

  


  


  


  


  


### 多个Runtime Filter在执行上生效使用

当前，scan算子上有多个runtime filter时，执行上只使用了第一个runtime filter

  


  


###   [4.2 特性功能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

###   [4.3 特性性能点1](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)  

###   [4.4 特性性能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)  

###   [4.5 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

###   [4.6 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

###   [4.7 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

**子章节的数目和1.3 需求分析中特性涉及数是对应的，除非功能点很小，在1.3的概述中几句话就能讲明白。**

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

  


```
alter session set _ENABLE_EXPLAIN_STATS = FALSE;

alter session set BLOOM_FILTER_FACTOR = 1;

CREATE TABLE tt1 (c1_rand INT, c2_rand INT, c3_rand INT, c4_rand INT, c5_rand INT) PARTITION BY HASH(c5_rand) PARTITIONS 5;

CREATE TABLE tt2 (c1_rand INT, c2_rand INT, c3_rand INT, c4_rand INT, c5_rand INT) PARTITION BY HASH(c5_rand) PARTITIONS 5;

CREATE TABLE tt3 (c1_rand INT, c2_rand INT, c3_rand INT, c4_rand INT, c5_rand INT) PARTITION BY HASH(c5_rand) PARTITIONS 5;

begin
    for i in 1..1000 loop
        insert into tt1 values(i, i, i, i, i);
    end loop;
end;
/

insert into tt2 select * from tt1;

insert into tt3 select * from tt2;

commit;

SELECT  COUNT(*) FROM tt1 a, tt2 b, tt3 c WHERE a.c1_rand=b.c1_rand and a.c1_rand=c.c1_rand;
```

  


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

  


[  Ob runtime filter​  ]        [https://www.oceanbase.com/docs/common-oceanbase-database-cn-1000000000036240](https://www.oceanbase.com/docs/common-oceanbase-database-cn-1000000000036240)       Runtime Filter

  [YDBRD-8125 : Dstb Runtime Filter Design（分布式Runtime Filter方案设计）](107381981.html)  

  [Runtime Filter概要设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=141562938)  

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

1. OB有一个Part join Filter的概念，先执行build侧，可以得到数据特征，如果probe侧是一个分区表，可以根据分区分布特征过滤掉不必要的分区，进一步提升性能，限定使用场景，join key必须包含probe表的分区键。
1. 索引没有支持并行，两表join，不能生成hash join，创建索引之后，无法使用runtime filter   —   **后续需要支持索引并行，否则创建索引后，可能会导致查询变慢**
1. RUNTIME FILTER(RUNTIME CREATE(1):   **Tuple[0, 0], Tuple[0, 1]**   src: [3] [4] [5] dst: [3] [4] [5] )的多列runtime filter  ----   **可以按单独列去生成多个runtime filter **   


### doris 数据库规划(参考)

1. 只支持对join on clause中的等值条件生成Runtime Filter，不包括Null-safe条件，因为其可能会过滤掉join左表的null值。    **— 后续可以增强对NULL值的处理**
1. 不支持将Runtime Filter下推到left outer、full outer、anti join的左表；
1. 不支持src expr或target expr是常量；
1. 不支持src expr和target expr相等；
1. 不支持src expr的类型等于  HLL  或者  BITMAP  ；
1. 目前仅支持将Runtime Filter下推给OlapScanNode；  —   **当前SR，支持下推给probe 侧的join两侧**
1. 不支持target expr包含NULL-checking表达式，比如  COALESCE/IFNULL/CASE  ，因为当outer join上层其他join的join on clause包含NULL-checking表达式并生成Runtime Filter时，将这个Runtime Filter下推到outer join的左表时可能导致结果不正确；
1. 不支持target expr中的列（slot）无法在原始表中找到某个等价列；
1. 不支持列传导，这包含两种情况：
1.     - 一是例如join on clause包含A.k = B.k and B.k = C.k时，目前C.k只可以下推给B.k，而不可以下推给A.k；  —   **当前SR去做支持**
    - 二是例如join on clause包含A.a + B.a = C.c，如果A.a可以列传导到B.a，即A.a和B.a是等价的列，那么可以用B.a替换A.a，然后可以尝试将Runtime Filter下推给B（如果A.a和B.a不是等价列，则不能下推给B，因为target expr必须与唯一一个join左表绑定）；

1. Target expr和src expr的类型必须相等，因为Bloom Filter基于hash，若类型不等则会尝试将target expr的类型转换为src expr的类型；  ----   **部分类型可以增加cast，后续可以增强，当前在优化器有一个增加cast的处理**
1. 不支持  PlanNode.Conjuncts  生成的Runtime Filter下推，与HashJoinNode的  eqJoinConjuncts  和  otherJoinConjuncts  不同，  PlanNode.Conjuncts  生成的Runtime Filter在测试中发现可能会导致错误的结果，例如  IN  子查询转换为join时，自动生成的join on clause将保存在  PlanNode.Conjuncts  中，此时应用Runtime Filter可能会导致结果缺少一些行。


### 问题

1. 为什么runtime filter可以提升查询性能，runtime filter跟一般的filter不同点是什么？
1. 为什么不在同一个stage group 的runtime filter不能生效使用？ --- 保留问题
1. 可能会造成的影响，max_stage_per_execute需要更大，负责runtime 不会生效


  


1.需要覆盖所有join类型吗？inner/left/right/full/cross  — 需要    
  2.需要覆盖所有表类型吗：heap/tac/lsc、分布表、复制表  — 需要    
  3.Hash join在CN，Hash join在DN，我们用的哪种方式   — 两种都可能会存在    
  4.需要测视图吗  – 需要    
  5.存在build边为join的情况吗  — 可能会存在    
  6.多表join方式：((t1 join t2) join t3) join t4 or ((t1 join t2) join (t3 join t4)  — sql写法可以是打乱的，优化器会遍历不同的组合，选择合适的join order顺序    
  7.viewScan和集合算子是什么   — 集合算子比如union/union all/minus    
  满足下推条件是什么      
  二元操作算子是什么   — 有左右表达式，比如join

8.过滤条件in/not in/null/not null会下推吗    
  9.join key为表达式会生成runtime filter吗，比如t1.c1 = t2.c1 + 1;   — 可以    
  10.join key为分布键，分区键和普通列有啥区别吗   ---- 决定生成的runtime filter是否需要进行分发，如果是分布键，生成的runtime filter不需要进行分发

11. join key为lsc order key和普通列是一样的吗    
  12. join key为ac列会走hash join吗    
  13. join key有啥需要特别关注的类型吗

  


## Attachments:

[image2024-7-1_15-30-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDE4OTcwYzJhZjRmNTIxNjNlIiwicmVmX2lkIjoiNjczOTZlMDA3MjgyMDZlZmI5MmYyNGQ2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNTI0LCJleHAiOjE3ODIzOTk5MjR9.bHXjr7J9ZSwOTLqnz8cAYZfTRqfae0wT_dcehwjj_OU)

 (image/png)    


## Comments:

|  [](null)  ,1. 选出了多个runtime Filter，实际执行只会用其中一个，一个ready之后，就不会等剩下的runtime filter了
,Posted by heyang at 六月 17, 2024 14:21|
|---|
|  [](null)  ,1. 索引没有支持并行，两表join，不能生成hash join  ---- 可能会更慢
,Posted by heyang at 六月 19, 2024 18:02|
|  [](null)  ,1. join key的两边类型不一样，number类型的p和scale不一样，需要增加cast类型提升，确认下是否可以增加cast，optmzAdjustCmpType(不同类型的分发，是否会有影响)
1. 验证下tpcds语句，需要做runtime filter增强的，现在是做了语句改写
1. 嘉实的Q4语句验证，实际执行效果
1. 按列去生成多个runtime filter 
1. 确认下带primary key的列，加hint走hash join，是否可以生成runtime filter
,Posted by heyang at 六月 21, 2024 14:36|
|  [](null)  ,10月10日上车工程分析结果,Posted by heyang at 十月 11, 2024 15:38|
|工程名|用例文件名|结果|分析|
|  [Agile_L2_dst_tac_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/2972/)  |test_ydbrd8125_hash_right_join_10_tac|结果不一致|生成计划，过滤执行中间结果不一样，导致隐式转换可能存在有所差别刷新预期|
|  
|test_ydbrd8125_hash_right_join_11_tac_2|结果不一致|生成计划，过滤执行中间结果不一样，导致隐式转换可能存在有所差别刷新预期|
|  
|test_ydbrd8125_runtime_tac_01|结果不一致|生成计划，过滤执行中间结果不一样，导致隐式转换可能存在有所差别刷新预期|
|  
|test_ydbrd8125_hash_full_join_03_tac|结果不一致|生成计划，过滤执行中间结果不一样，导致隐式转换可能存在有所差别刷新预期|
|  
|test_ydbrd8125_hash_inner_join_05_tac|结果不一致|生成计划，过滤执行中间结果不一样，导致隐式转换可能存在有所差别刷新预期|
|  [Agile_L2_dst_lsc_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3204/)  |test_ydbrd8125_runtime_01|结果不一致|生成计划，过滤执行中间结果不一样，导致隐式转换可能存在有所差别刷新预期|
|  
|test_sdv_ydbrd26119lsc_02_2|snapshot too old|跟runtime filter无关|
|  [Agile_L2_dst_tac_TX](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_TX/4075/)  |  
|结果不一致|reparser问题，无runtime filter无关|
|  [Agile_L2_sa_upgrade_FT_2_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_2_docker/4484/)  |  
|  
|  
|
|  [Agile_L2_sa_tac_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/3695/)  |test_sdv_multi_table_update_sub|内存不足，表未创建出来|无关|
|  
|bloom_hash_left_right_join_11_tac|预期能查询出来，结果报错|runtime filter过滤有无效的number值，报错，刷新预期|
|  
|bloom_hash_full_join_11_tac|预期能查询出来，结果报错|runtime filter过滤有无效的number值，报错，刷新预期|
|  [Agile_L2_sa_heap_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/4346/)  |SP_WK_RPT_INFO|高级包多了错误信息|无关|
|  
|tbs_space_file_parallel_01|没有空间|无关|
|  
|test_ydbrd_5180_partition_update_001|集合查询结果不对|无关，前面用例影响|
|  
|test_yaswrap_sm3_sr31455_22|审计结果不一致|无相关修改，无关|
|  
|test_sdv_shrink_table_041|dba视图查询结果不一致|存储条数不一样，无关|
|Agile_L2_sa_lsc_yasft_arm|test_sdv_filter_exists_02|报表不存在|无关|


|工程名|用例文件名|结果|分析|
|---|---|---|---|
|  [Agile_L2_dst_tac_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/2972/)  |test_ydbrd8125_hash_right_join_10_tac|结果不一致|生成计划，过滤执行中间结果不一样，导致隐式转换可能存在有所差别刷新预期|
|  
|test_ydbrd8125_hash_right_join_11_tac_2|结果不一致|生成计划，过滤执行中间结果不一样，导致隐式转换可能存在有所差别刷新预期|
|  
|test_ydbrd8125_runtime_tac_01|结果不一致|生成计划，过滤执行中间结果不一样，导致隐式转换可能存在有所差别刷新预期|
|  
|test_ydbrd8125_hash_full_join_03_tac|结果不一致|生成计划，过滤执行中间结果不一样，导致隐式转换可能存在有所差别刷新预期|
|  
|test_ydbrd8125_hash_inner_join_05_tac|结果不一致|生成计划，过滤执行中间结果不一样，导致隐式转换可能存在有所差别刷新预期|
|  [Agile_L2_dst_lsc_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3204/)  |test_ydbrd8125_runtime_01|结果不一致|生成计划，过滤执行中间结果不一样，导致隐式转换可能存在有所差别刷新预期|
|  
|test_sdv_ydbrd26119lsc_02_2|snapshot too old|跟runtime filter无关|
|  [Agile_L2_dst_tac_TX](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_TX/4075/)  |  
|结果不一致|reparser问题，无runtime filter无关|
|  [Agile_L2_sa_upgrade_FT_2_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_2_docker/4484/)  |  
|  
|  
|
|  [Agile_L2_sa_tac_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/3695/)  |test_sdv_multi_table_update_sub|内存不足，表未创建出来|无关|
|  
|bloom_hash_left_right_join_11_tac|预期能查询出来，结果报错|runtime filter过滤有无效的number值，报错，刷新预期|
|  
|bloom_hash_full_join_11_tac|预期能查询出来，结果报错|runtime filter过滤有无效的number值，报错，刷新预期|
|  [Agile_L2_sa_heap_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/4346/)  |SP_WK_RPT_INFO|高级包多了错误信息|无关|
|  
|tbs_space_file_parallel_01|没有空间|无关|
|  
|test_ydbrd_5180_partition_update_001|集合查询结果不对|无关，前面用例影响|
|  
|test_yaswrap_sm3_sr31455_22|审计结果不一致|无相关修改，无关|
|  
|test_sdv_shrink_table_041|dba视图查询结果不一致|存储条数不一样，无关|
|Agile_L2_sa_lsc_yasft_arm|test_sdv_filter_exists_02|报表不存在|无关|
