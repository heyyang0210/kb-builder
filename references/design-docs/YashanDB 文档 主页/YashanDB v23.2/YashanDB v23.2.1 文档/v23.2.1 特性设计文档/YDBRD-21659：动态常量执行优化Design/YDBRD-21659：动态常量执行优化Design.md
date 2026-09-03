Created by 朱月婷 on 一月 29, 2024

  [YDBRD-21659](https://jira.yasdb.com/browse/YDBRD-21659?src=confmacro)    -  动态常量执行优化  完成

#   [YDBRD-21659 : 动态常量执行优化 Design](#ydbrd-21659--动态常量执行优化-design)  

SR链接：    [https://jira.yasdb.com/browse/YDBRD-21659](https://jira.yasdb.com/browse/YDBRD-21659)  

##   [1. Overview（概述）](#1-overview概述)  

在执行过程中，有些变量，其值在一定执行时间内，甚至整条sql语句执行中都不会改变，对于该种变量，可将其内容缓存下来，下一次访问的时候检查是否可以直接取用，如果可以，从缓存中读取该数据；如果不行，则执行表达式并将值缓存下来。

其中注意，在数据失效时，及时清理表达式，确保下次执行取到的数据正确。

该特性用户不感知。

##   [2. Features（功能特性）](#2-features功能特性)  

|优化项|说明|举例|备注|
|---|---|---|---|
|1. 静态常量高速缓存|用户输入的字面量|  
,```
select * from t1 where c1=1;

```|filter的右值1是静态常量|
|2. 动态常量高速缓存|如果某个可重入的在where条件中，可能把条件下推到某个表中，如果表很大的话，每条都要做转换，开销很大，优化成转换一次，就会变成一百万次执行，一次转换|```
create or replace procedure proc_bindperf_001(par1 in varchar,par2 in out varchar) as
	var2 VARCHAR(200);
begin
	EXECUTE IMMEDIATE 'SELECT   COUNT(*) FROM tb_sdv_bindperf_001  WHERE c8 &lt; TRUNC(TO_DATE(:1, ''YYYY-MM-DD''),:1) ' into var2 using par1,'Q';
	--dbms_output.put_line(var2); 
end;
/

declare
	a1 varchar(200) := '2023-11-01';
	a2 nvarchar2(200) := null;
begin
	proc_bindperf_001(a1,a2);
end;
/

```|par1的值通过绑定参数的方式传入，参数值确认，trunc,to_date函数嵌套的结果确定，这种常量是动态常量。|
|  
|nest loop join：,执行原理，左表出一条记录，右表全表扫描；在右表全表扫的过程中，左表的记录不变，在原有的设计中右表扫到一条，左表转换一次，现优化为右表在一次全表扫的过程中，左表只转换一次|```
select * from tac_nestloop_l_table as ltb full join tac_nestloop_r_table as rtb on ltb.l_col1 != rtb.r_col3;

explain计划 join走的是nest loop full outer

```|  
|
|  
|投影中大量重复表达式：|```
select sum(case when c1 = to_date(:1,'YYYY-MM-DD') then c2 end) as proj0,
sum(case when c1 = to_date(:1,'YYYY-MM-DD') then c2 end) as proj1,
sum(case when c1 = to_date(:1,'YYYY-MM-DD') then c2 end) as proj2,
sum(case when c1 = to_date(:1,'YYYY-MM-DD') then c2 end) as proj3,
.
.
.
sum(case when c1 = to_date(:1,'YYYY-MM-DD') then c2 end) as projn from t1;

```|目标：该条语句投影列出现大量相同参数的to_date函数，且参数为常量和绑定参数，该种场景可以进行优化,  
,注：filter中出现重复的表达式，不会被优化。|
|  
|算子执行优化：,相同算子的重复表达式只计算一次|```
select * from t1 where c1=to_date(c3,'YYYY-MM-DD') and c2=to_date(c3,'YYYY-MM-DD') ... ;

```|在某层算子中，其中存在重复的表达式，对于这些表达式，将只计算一次，|
|3. 函数对动态常量的支持排查|已在规格约束中描述不会进行优化的函数。|```
--优化
select * from t1 where c1=bit_length(:1);

--不优化
select * from t1 where c1=bit_length(c1);

```|当函数的入参不确定，结果不确定时，不进行优化。,  
,注：当函数的入参是常量，函数本身不是volatile型函数，将会进行改写，表达式类型由function被改为const，目前在后续的执行过程中不会被优化。,  
,volatile函数目前包括（主要为时间相关函数）：,CURRENT_TIMESTAMP，DATE，DATE_ADD，DATE_FORMAT，DAYOFWEEK，EMPTY_BLOB，EMPTY_CLOB，LAST_DAY，LOCALTIME，LOCALTIMESTAMP，MONTHS_BETWEEN，NEXT_DAY，NOW，RANDOM，SCN_TO_TIMESTAMP，SYSDATE，SYSTIMESTAMP，SYS_CONTEXT，SYS_GUID，TIME，TIMEDIFF，TIMESTAMP，TIMESTAMPDIFF，TIMESTAMP_TO_SCN，TO_DATE，TO_TIMESTAMP，USERENV，UTC_TIMESTAMP|
|4. 动态常量扩散和终止规则|寻找最大子树|  
,  
,```
--优化
select * from t1 where c1=(:1)+1;

--不优化
select * from t1 where c1=c3+c2;

```|在语句生成的表达式中，寻找可优化的最大子树，遇到结果无法确定的表达式为止。|


|动态常量类型|描述|
|---|---|
|sysdate||
|用户输入|用户输入的字面量|
|系统变量|user_env sid|
|已绑定的参数|如绑定参数，nest loop join时右子树引用的左子树的列|


优化包括两个方面：

（1） 绑定参数执行优化，主要体现在数据以常量或绑定参数的形式传入，输入是确定的，输出即是确定的，在执行过程中，对于该种表达式，将只执行一次，将结果缓存下来；后续的执行过程中将从从缓存中读取数据；

（2） 算子执行优化，对于重复的表达式，在首次计算时缓存该值，后续从缓存区取值。但注意要及时将表达式对应的值存为无效。

##   [3. Interfaces（接口）](#3-interfaces接口)  

CodResult trsfDynamicConst(AnlOptimizer* optmzr, AnlWalker* walker)

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

优化上限2M个

功能上，用户不感知该特性；

- 不支持优化的内置函数类型：代码内部以白名单形式实现


1.结果变化的函数：random，sys_guid，sys_context_by_path, userenv,

2.返回值为lob类型的函数：例empty_blob, empty_clob，json函数

3.array函数

注：对于聚集函数，不会将其优化常量形式，但对其内部表达式同样会展开并做去重。

- 不支持存储过程中的UDF，UDP，ADT
- 支持的算子，代码内部以白名单实现：


1. 目前所有表扫描算子：PLAN_TABLE_FULL_SCAN/PLAN_INDEX_UNIQUE_SCAN/PLAN_INDEX_RANGE_SCAN/PLAN_INDEX_FULL_SCAN/PLAN_INDEX_FULL_SCAN_MIN_MAX/PLAN_INDEX_RANGE_SCAN_MIN_MAX/PLAN_INDEX_FAST_SCAN/PLAN_INDEX_SKIP_SCAN/PLAN_SPATIAL_INDEX_SCAN/PLAN_ROWID_SCAN/PLAN_AC_SCAN/PLAN_PART_ALL_SCAN/PLAN_PART_SINGLE_SCAN/PLAN_PART_ITERATOR_SCAN/PLAN_PART_COMBINED_ITERATOR_SCAN/PLAN_PART_MULTICOL_SCAN


2.NEST LOOP JOIN算子：PLAN_NESTLOOP_JOIN/PLAN_NESTLOOP_OUTER_JOIN/PLAN_NESTLOOP_FULL_OUTER_JOIN/PLAN_NESTLOOP_SEMI/PLAN_NESTLOOP_ANTI

3.其他算子：SELECT，SORT, AGGR, HASH_GROUP, SDT_GROUP

注：形如length(:1)形式的优化不受是否支持算子的限制。不支持算子表示将不遍历该算子的表达式，即不对齐进行优化缓存。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

说明方案的总体架构，优先考虑通过架构图进行描述。给出业务架构和对应的技术架构，可参考资料：    [https://zhuanlan.zhihu.com/p/269201440](https://zhuanlan.zhihu.com/p/269201440)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

- 新增结构体DynamicConstVar，其中isExecuted表示该表达式是否执行过，直接可取值。


```
typedef struct StDynamicConstVar {
    Variant  value;
    CodBool  isExecuted;
    CodBool  isExtended;
    CodUint8 reserved[6];
} DynamicConstVar;

```

####   [5.2.1 算子执行优化](#521-算子执行优化)  

|阶段|步骤|备注|
|---|---|---|
|trsf|**主要目的**  ：拉平去重计划中的表达式,  
,**遵循原则**  ：,1.拉平原则：根据计划遍历，将所有的表达式存在一个数组中，取到一个新的表达式，需要和已有的表达式进行比较，如果重复则不重复放入。,2.遵循扩散与终止规则：遇到非动态常量的表达式停止；,  
,**流程描述**  ：,①trsf阶段阶段根据plan遍历所有表达式，在planContext上建立一个数组，用于存储全局的去重的数组，主要更新以下几个标志位：,varIndex：用于对应缓存的value存放位置；,hasCache：用于表明是否为该表达式准备缓存；,isDynConst：用于表明该表达式缓存值的周期是否是整条sql。,②设置isDynConst，遵循扩散与终止原则，以常量和绑定参数为最小单位，进行扩散，如参数为常量或绑定参数的函数，或常量或绑定参数参与的四则运算等，遇到如列变量等会改变的表达式，停止遍历。寻找可优化的最大子树。,③在每层计划的plan上会挂一个数组，该数组用于存执行当前计划中所需要的表达式，可能函数有与计划中的投影表达式数组中重复的表达式。|与当前已有判断表达式是否为const的条件进行参考：,```
static inline CodBool isExprNodeGeneralConst(const ExprNode* node)
{
    switch (node-&gt;type) {
        case EXPR_SYSVAR:
            return !isExprNodeRownum(node) &amp;&amp; !isExprNodeCbySysVar(node);
        case EXPR_PARAM:
        case EXPR_CONST:
        case EXPR_REF:
            return COD_TRUE;
        case EXPR_QUERY:
            return isExprNodeStaticQuery(node);
        case EXPR_FUNCTION:
            return isGeneralConstFunc(node);
        default:
            return COD_FALSE;
    }
}

```,dynamic const对于REF, QUERT, CONST类型停止遍历并返回原节点。,对于FUNCTION类型，仅接受内置函数（除random，sys_guid外），对于其中的参数继续遍历判断。否则返回原节点。,  
|
|preExecute|根据拉平去重后的表达式数组个数，在preExecute阶段，预分配好一片空间，用于缓存表达式结果做准备。,  
,**页面管理方式**  ：二级页面管理,单个页面可存储1024个表达式的缓存。,申请空间：为表达式申请空间，最多2M个表达式。,  
,**初始化方式：**,为了不影响extend标志位，初始化的方式为将每个var取出来为isExecuted赋值。|空间大小为count * sizeof(DynamicConstVar),```
typedef struct StDynamicConstVar {
    Variant  value;
    CodBool  isExecuted;
    CodUint8 reserved[7];
} DynamicConstVar;

```|
|execute|执行阶段根据计划深度优先遍历执行，在进入每层算子时，优先清理该算子所涉及表达式的表达式。,**清理表达式的原则**  ，先看父亲的是否需要清理，如果需要，先清理父亲的， 再清理自己的，清理之后将isValid置为false，再执行。,当前plan执行完成后，将当前plan的isValid置为true，用于下次该计划的子计划清理。,执行阶段，ExprNode的cache为true，将根据node的varIndex，取出dynConstVar，判断是否是isExecuted,如果为true，说明已经计算过，可以直接取返回value,如果为false，说明仍需计算，计算完之后进行判断，如果返回值是lob或长度超过32000的变长数据，则不进行缓存,对于dynamicConst的变长表达式首次执行申请64Bytes，如果超出当前申请空间，则free当前空间，重新申请|  
|


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


具体场景及数据见链接：    [https://conf.yasdb.com/pages/viewpage.action?pageId=138564416](https://conf.yasdb.com/pages/viewpage.action?pageId=138564416)  

##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*