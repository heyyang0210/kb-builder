Created by 叶显昊, last modified on 七月 05, 2024

IR链接：    [https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf42](https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf42)    ?#YASHAN-1078  执行态hash join条件下推

SR链接：    [https://pingcode.yasdb.com/pjm/items/66194363fd997db58ad8c1a4](https://pingcode.yasdb.com/pjm/items/66194363fd997db58ad8c1a4)    ?#YDBRD-26329 执行态hash join条件下推

##   [1. 总述](#1-总述)  

- hash join的build侧在原始值比较少的情况下，支持下推所有值到probe侧，利用存储稀疏索引加速。


###   [1.1 需求来源](#11-需求来源)  

- 需求来源于嘉实基金POC


###   [1.2 需求分析](#12-需求分析)  

- 在原始值比较少的情况下，支持下推所有值到存储，利用存储稀疏索引加速。


##   [2. 接口](#2-接口)  

- alter session set bloom_filter_factor=1; 该参数开启布隆过滤器将build表结果下推到probe表做过滤。


##   [3. 规格与约束](#3-规格与约束)  

- build侧原始值比较少的情况（不超过16）
- 必须有probe表的column，对于probe表的非column的表达式不生效
- 依赖于runtime filter的计划


##   [4. 特性](#4-特性)  

- 将原始值下推到probe侧，probe侧table scan层可获取到下推数据。


###   [4.1 场景描述](#41-场景描述)  

- hash join在执行时，join condition一定是等值连接，即左表列=右表列
- hash join在执行时会先扫描右表所有数据，建立hash table，然后使用hash table对左表数据过滤，生成最终结果。
- 对于右表数据量比较少的情况，可以将原值直接下推到左表的table scan层，进行比较过滤


###   [4.2 执行流程](#42-执行流程)  

- 在构建hash table的时候，记录key的原始值，如果构建完成后原始值的数量较少（不超过16），则将原值下推到probe侧。
- 判断左表的表达式类型，只有是column的时候才会生效。
- 如果左右类型不相等，对下推的column做一次cast，如果cast失败则不生效。
- 遍历
    - 将一列中每一行的值取出，生成一个PointRange
    - 将每列所有PointRange组成一个RangeChain
    - 将所有RangeChain组合成一个数组，调用之前索引的接口，对RangeSet执行bind操作，生成一个BoundFilterRangeSet


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

- 单列hash join
- 多列hash join
- 左右类型不相同可以转换
- 左右类型不相同不可以转换
- 左表列不是column


##   [6.资料设计章节](#6资料设计章节)  

不涉及

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Comments:

|  [](null)  ,可以提前测试一下性能,规格：原本就有条件的情况下，与此特性产生的条件是and关系，使用原本的条件,增加autotrace和trace日志,Posted by yexianhao at 六月 04, 2024 10:29|
|---|
