Created by 何阳, last modified by  许中立 on 一月 30, 2024

JIRA：    [YDBRD-13633](https://jira.yasdb.com/browse/YDBRD-13633?src=confmacro)    -  insert into select，Insert into多个value调整使用存储批量插入接口  完成

## 1. Overview（概述）

带有子查询的插入语法，无论行表还是列表，都是调用的行表的插入接口，插入速度慢，为了优化插入性能，实现列表走批量插入接口。

支持单机情况下的，列表带子查询插入

## 2. Features（功能特性）

分布式下，带有子查询的列表，不用走行插入接口，直接走列批量插入接口，提高插入性能

单机部署中，对列存表执行INSERT操作可以使用子查询语法 (修改doc材料)

## 3. Interfaces（接口）

没有变更insert的语法，语法可以参考文档：    [https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/INSERT.html](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/INSERT.html)  

## 4. Limitations（功能限制）

1. 分布式下不支持insert all into多表插入
1. 分布式还未支持行表，不支持行列表混合的插入
1. **行列表混合的情况下，都是走行执行引擎，不支持走列执行引擎，不支持行列混合的insert插入**
1. 不支持内置cast转换以外的数据插入
1. **沿用分布式不支持多表插入限制**
1. **insert 带duplicate还是走行执行引擎**
1. **单机部署，insert all多表插入的子查询还是走行执行引擎**


## 5. Detail Design（详细设计）

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

  


**因为列执行引擎基本上都是用rust代码实现，在rust实现会比较方便，不然需要暴露比较多的rust接口到C语言层去做调用**

### 5.1 增加强制类型转换

参考文档：    [类型统一、转换和提升表格](/pages/createpage.action?spaceKey=YAS&title=%E7%B1%BB%E5%9E%8B%E7%BB%9F%E4%B8%80%E3%80%81%E8%BD%AC%E6%8D%A2%E5%92%8C%E6%8F%90%E5%8D%87%E8%A1%A8%E6%A0%BC)  

考虑到子查询的表和待插入的表，可能存在投影列和待插入列的数据类型不一致，为了能够插入正确的数据，需要做类型的强制转换。

数据的类型强制转换可以在计划层增加，也可以在执行层去增加。

**为了性能考虑，采用方案2**

  


|方案|优点|缺点|
|---|---|---|
|#### 方案1：在select计划上增加cast的强制转换函数|计划层增加，无需在后面做数据合法性校验|现有AnlPlan没有上层表信息，需要为了这个额外增加一套数据结构|
|#### 方案2：在执行层增加cast强制转换操作|计划层无需增加，插入的时候需要在执行引擎增加校验|在行执行引擎和列执行引擎分别增加插入数据校验，需要维护两套代码|


### 5.2 待插入的表和投影列不匹配

1. 当待插入的列少于投影列，报错
1. 当插入列等于投影列，判断是否有数据类型不一致的问题，如果有，要做数据类型转换
1. 当待插入列大于投影列，如果投影列为nullable属性，需要额外补充null的数据到dataset上


  


### 5.3 分区表的插入

    待插入表为分区表时，需要在本地节点上，按照分区算法，先将fetch过来的columnSet，拆分成不同的columnSet，然后插入到不同的分区表中

  


### 5.4 主要代码逻辑

  


###   [优化器代码逻辑](#优化器代码逻辑)  

```
cboOptimize 计划生成
 - 1. genLogiDmlDesc 树状组织结构 -&gt; genLogiInsertDesc -&gt; setRealExecEngine （设置实际执行引擎）
 - 2. optimize 优化
 - 3. createPlanFromOpTree(将算子转换成计划) -&gt; createPlanFromOp 递归生成计划 -&gt; createInsert -&gt; createSelect（根据parentFlag决定是否生成col2row计划）
 - 4. copyPlans 拷贝计划

```

###   [列执行器代码逻辑](#列执行器代码逻辑)  

```
CodResult execInsertPlan(AnlStmt* stmt, AnlPlan* plan)
{
	if (plan-&gt;insert.subQueryPlan != NULL &amp;&amp; isPreColExecute(stmt) &amp;&amp; !plan-&gt;insert.isMultiInsert) {
		// 在函数主体的实现在col-executor模块 回调函数的方式实现
        COD_RESOURCE_CALL(execColInsertSubQuery(stmt, plan), ankInitDupcnt(stmt-&gt;handler-&gt;khdlr)); 
        return COD_SUCCESS;
    }
    // 现有逻辑不变

	return COD_SUCCESS;
}

```

```
pub fn exec_col_insert_subquery&lt;PxBuilder&gt;(
    mut stmt: Statement,
    plan: &amp;mut Plan,
    builder: PxBuilder,
    cursor: &amp;mut Cursor,
) -&gt; Result&lt;()&gt;
where
    PxBuilder: LogicalPxBuilder,
{
	// 1.transform logic insert plan

	// 2.get table dict and projection

	// 3.prepare schema

	// 4.get logic scan plan

	// 5.innert cast （投影列和待插入列，类型不一致需要做强制内部类型转换）

	// 6.1 fetch

	// 6.2 verify 检查投影和插入列是否一致 &amp; 待插入数据是否超过类型边界

	// 6.3 prepare dataset by column_set

	// 6.4 bactch insert

	// 7.set affetcrows and finish batch insert
}

```

###   [故障场景](#故障场景)  

在分布式DML故障处理框架内，无需增加额外故障处理

  


## 6. Testcases（自测用例）

*设计开发人员自测用例（文字描述）。*

```

// 1. 基本测试场景用例

drop table if exists t1;
drop table if exists t2;
create table t1(r1 varchar(10), r2 int) organization tac;
create table t2(r1 int, r2 int) organization tac;

insert into t2 values(1,1),(2,2),(3,3),(4,4),(5,5),(6,6),(7,7),(10,10);

--- 预期成功，没有col2row计划
expain insert into t1 select * from t2;

--- 预期成功
insert into t1 select * from t2;

--- 预期失败
create table t3(c1 varchar(1)) organization lsc;
insert into t3 select * from t2;


create table test_dml_set_directexecute_off3(c1 int,c2 char(20),c3 date) ORGANIZATION TAC distribute by hash(c1);
insert into test_dml_set_directexecute_off3 values(0,'SjCiv#','2403-10-08');
insert into test_dml_set_directexecute_off3 values(1,'IR!_hz','2697-04-22');
insert into test_dml_set_directexecute_off3 values(2,'hz(ymY','2082-10-20');
insert into test_dml_set_directexecute_off3 values(3,'SjCiv','2553-05-12');
insert into test_dml_set_directexecute_off3 values(4,'zYuiCz','2483-06-23');

create table test_dml_set_directexecute_off4(c1 int,c2 char(20),c3 date) ORGANIZATION TAC distribute by hash(c1);

--- 预期成功
insert into test_dml_set_directexecute_off4(c1, c2, c3) select * from test_dml_set_directexecute_off3;

--- 插入缺省列
insert into test_dml_set_directexecute_off4(c1, c2) select c1, c2 from test_dml_set_directexecute_off3;


--- 投影有重复列
insert into test_dml_set_directexecute_off4(c1, c2, c3) select c1,c1,c3 from test_dml_set_directexecute_off3;


--- 2.补充内部cast转换的用例，测试边界条件，可以找相依测试

--- 3.有行列表混合插入情况
--- 分布式不支持创建行表，先通过单机的行列混合用例看护，可以本地先把分布式行表打开，验证下
--- 预期报错不支持
insert into t1 select * from dual;

--- 4.多表插入
--- 预期报错不支持
insert all into t1 values(1) into t2 values(1) select * from t1;

--- 5.增删列后插入


--- 单机测试用例
--- 1.基本用例

--- 2.现有的insert into select用例跑通

--- 3.行列混合带子查询的用例

--- 4.多表多行插入用例
create table t1(r1 int, r2 int, r3 varchar(10)) organization tac;

create table t2(r1 int, r2 int, r3 varchar(10)) organization tac;

create table t3(r1 int, r2 int, r3 varchar(10)) organization tac;

insert into t1 values(1,1,1),(2,2,2),(3,3,3);
insert into t2 values(11,11,11),(12,12,12),(13,13,13);

insert all into t1 values(4,4,4) into t3 values(14,14,14) select * from t2;

select * from t3;

select * from t1;
-- 性能测试

```

## 7. Workload（工作量）

*评估代码量KLOC、工作量（人天）。*

|描述|预期工作量|
|---|---|
|基本流程梳理&验证|1.5人天|
|计划部分调整|1人天|
|执行部分调整|3人天,→ 8人天|
|自测&问题解决|3人天,→ 6人天|


预计代码量0.7k左右，预计工作量10人天 → 18人天

## 8. TODO（遗留问题）

*说明本方案遗留的问题或下一步需要解决的问题。*

## Comments:

|  [](null)  ,会议纪要：    
  Insert into select批量插入优化方案设计    
  时间：2023年6月6日10:40~11:50    
  参与人员：    
  徐晓锋 黄靖东 马文英 刘清萍 何阳,1.explain增加行执行引擎信息打印    
  2.clob类型支持，对这部分的影响，限制为inline varchar    
  3.json类型验证    
  4.select into限制？确认是否走broadcast，如果确认是走broadcast就先不要走批量插入流程    
  5.注意：时间函数 cast转换需要单独实现，根据当前session的data format    
  6.verify 检查投影和插入列是否一致 & 待插入数据是否超过类型边界 分成运行时和执行前校验，确保尽可能少的影响插入性能    
  7.cast转换，char和int判断，插入时的合法性校验    
  8.为了降低性能影响，cast转换采用方案2，在执行层增加类型转换，方便后续列存会做类型转换演进    
  9.单机，先单独提mr禁掉行列混合子查询插入，跑上车，如果不需要大批量修改用例，先禁掉,Posted by heyang at 六月 06, 2023 14:24|
|---|
