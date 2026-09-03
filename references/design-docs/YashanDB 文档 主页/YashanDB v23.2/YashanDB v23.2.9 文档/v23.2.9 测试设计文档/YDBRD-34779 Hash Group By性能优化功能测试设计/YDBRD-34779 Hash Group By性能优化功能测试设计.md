# 1. 概述

博时POC测试中，行表hash group by执行性能是ORACLE 7倍，因此需要进行优化。

  [https://pingcode.yasdb.com/pjm/items/6720390ce489dd0868007d06?](https://pingcode.yasdb.com/pjm/items/6720390ce489dd0868007d06?)  

#YDBRD-34779 hash group（行算子）性能通过分区与并行的方式优化 

# 2. 需求分析

## 2.1 功能点分析

### 2.1.1 基础物化区接口优化

当前物化区提供了一套基于VmContext和MatCache的接口，用于读写物化区数据。存在页面读取效率不高的问题，MatRow通过逻辑指针引用，每次引用都需要openVm，不适合用于管理较复杂的数据结构。在实现Partition Hash Join时，实现了RowCollection接口，简化了MatRow的存储方式，并提供了更高效的访问MatRow的方式。这些接口对Partition Hash Group来说还是不够用，比如不支持分区、不支持多读（写入时pinned住页面的同时，让其他业务可读）。为此需要对RowCollection进行改造：支持分区存储，页面添加引用计数来支持多读、支持定制读取和写入过程中对页面的操作(KEEP_PINNED、UNPIN、DESTROY)。

### 2.1.2 实现两阶段聚合函数接口优化

 使用AggrState表示聚集函数值，包含了Variant和buff，其中buff用于存储变长数据。使用AggrFunctionDecl描述每一个聚集函数，每个聚集函数定义了init、update、combine三个接口：

- init用于初始化AggrState。
- update为第一阶段聚集，根据参数表达式的执行结果更新AggrState。
- combine为第二阶段聚集，将一个AggrState合并到另一个AggrState。


        gAggrFunctionSet全局数组定义了所有聚集函数的tAggrFunctionDecl，针对改SR，当前只需实现count、sum、min、max四个聚集函数。

### 2.1.3 Partition HASH GROUP

      实现Partition Hash Group的目标是在内存有限的情况下，将整个分组聚集拆分为多个阶段，尽量保证每一步操作都在内存中完成，避免换入换出，同时提高内存访问的局部性，以达到提升性能的目的。分区数由统计信息(keyRowCount)、行数据大小（rowSize）、_HASH_AREA_SIZE大小综合决定。在keyRowCount准确的情况下，最终物化区将保留keyRowCount行数据，需要的内存大小由keyRowCount行数据和HashMap构成。其总大小为：

**       totalSize = keyRowCount * rowSize + NextPowerOfTwo(keyRowCount) * sizeof(AggrHashEntry)**

       为了尽量的将每个分区的数据都pinned在内存中，提升内存访问性能，需要尽量让每个分区所占的数据大小小于_HASH_AREA_SIZE，同时分区数不能大于最大分区数，最终的预估分区数为：

**       partitionCount = MIN(ROW_SET_MAX_PARTITIONS, NextPowerOfTwo(CEIL(totalSize / _HASH_AREA_SIZE)))**

1. Partition Hash Group分为三个阶段：


- 第一阶段：根据统计信息、行数据大小、_HASH_AREA_SIZE确定分区数（见下文），将生成多个RowSet、每个RowSet存储一批数据，最大大小为_HASH_AREA_SIZE（保证RowSet和HashMap全内存）。利用HashMap将具有相同GroupKey的数据进行合并，完成第一阶段聚集。在这个阶段，存在同一个RowSet中的所有数据的GroupKey都是不相同的，RowSet由多个Partition构成，数据根据哈希值分配到不同的Partition中，同一个RowSet中的多个Partition之间的数据是没有交集的。
- 第二阶段：将多个RowSet相同的分区合并为一个分区，利用HashMap进行第二阶段聚集，最终数据保存在第一个RowSet中，其余RowSet被释放。合并分区可以采用并行方式，根据并行度配置。
- 第三阶段：扫描第一个RowSet，得到的结果即为HashGroup的最终结果。


1. 优化union all处理流程，提升性能。
1.  在对大基数表执行Hash Group时，第一阶段聚集几乎过滤不了数据，绝大部分数据都需要写入物化区，这时候查找hash map成为了不必要的开销。针对这种场景，第一阶段可以不做聚集，只做分区，省去查找hash map的开销。为了实现这一点，在物化的过程中，会对采样前5%的数据，当这部分数据的过滤率小于10%时，会禁用掉第一阶段聚集，第一阶段只做分区。
1.  当min/max聚集函数的参数是定义很大的变长数据类型时，若实际存储的值很小，可能会造成很大的空间浪费，同时带来很大的物化开销，可能会导致性能劣化。为了避免这种劣化，在trsfMat阶段，会对这类场景进行识别：当min/max聚集函数的参数为大于1KB的变长数据类型，且distinct值大于rows的1/2时，禁用Partion Hash Group，走HDT Hash Group。
1. AUTOTRACE增加定位信息：


- PartCount：分区数。
- rowSetCount：第一阶段生成的RowSet数量。
- TotalChunks：总共使用的页面数量。
- EstimateDistinct：统计信息预估的distinct值。
- RealDistinct：实际的distinct值。
- TotalRows：参与hash group的数据行数。
- MatRows：物化的数据行数。
- SwapCount：发生换入换出的次数。
- Dop：Combine并行度。
- Is2PhaseAggr：是否采用了两阶段聚集。
- CombineTime：Combine执行时间。




交付范围：单机和集群的行表。

## 2.2 应用场景

1）HASH GROUP BY查询

2）UNION ALL查询

## 2.3 规格约束

- 不修改原有实现，也不影响规格与约束，只对满足以下条件的Hash Group走新的实现：
    - 聚集函数只包含count、sum、min、max、avg。
    - 函数参数不带distinct。
    - keySize + valueSize小于ANK_MAX_ROW_SIZE(63KB)。
- Hash Group能使用的最大内存大小由_HASH_AREA_SIZE参数决定，会根据该参数决定分区数。
- Hash Group的最大分区数为512。
- Combine最大并行度由DEGREE_OF_PARALLEL控制，实际使用的并行度可能小于等于DEGREE_OF_PARALLEL。


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

主要采用等价类划分、场景法组合进行设计。

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|测试项|测试场景|预期|备注|
|---|---|---|---|
|GROUP BY|group by 单列，多列分组|观察计划变化|pass|
||group by多列，所有列size+聚集结果超过64K|优化不起作用|pass|
||group by having |观察计划变化|pass|
|聚合函数|hash group查询带以前聚合函数：,COUNT,SUM,MIN,MAX,AVG|观察计划变化|采用等价类验证,pass|
||min/max聚集函数的参数为大于1KB的变长数据类型|distinct值rows的1/2时，走Partion Hash Group||
||min/max聚集函数的参数为大于1KB的变长数据类型，实际存储小于1K|distinct值大于rows的1/2时，禁用Partion Hash Group，走HDT Hash Group。||
||hash group查询带以前聚合函数：,GROUP_CONCAT,LISTAGG,PERCENTILE_CONT,STDDEV,STDDEV_POP,STDDEV_SAMP,STRING_AGG,VARIANCE,VAR_POP,VAR_SAMP,WM_CONCAT|无变化|采用等价类验证,pass|
|DISTINCT|聚合函数带distinct|无变化|pass|
|UNION|UNION ALL|计划变化||
||UNION|无变化||
|GROUP KEY|全部相同|||
||50%相同|||
||不同|基表数据量大时可能无第一阶段聚集，只有分区||
|数据类型|定长：char, 数值类型和时间类型|||
||变长：varchar, nvarchar|||
|并行度|DEGREE_OF_PARALLEL配置1，分区不限|并行度1|采用场景组合|
||DEGREE_OF_PARALLEL配置8，分区4|并行度4||
||DEGREE_OF_PARALLEL配置8，分区8|并行度8||
||DEGREE_OF_PARALLEL配置8，分区16|并行度8||
||DEGREE_OF_PARALLEL配置255，分区16|并行度16||
||DEGREE_OF_PARALLEL配置255，分区512|并行度255||
||MAX_PARALLEL_WORKERS < DEGREE_OF_PARALLEL|并行度最大MAX_PARALLEL_WORKERS ||
||MAX_PARALLEL_WORKERS配置最小值 1|并行度1||
||MAX_PARALLEL_WORKERS配置最大值，与max_sessions配置相关|与MAX_PARALLEL_WORKERS，DEGREE_OF_PARALLEL和分区相关||
|_HASH_AREA_SIZE|_HASH_AREA_SIZE=1M|||
||_HASH_AREA_SIZE=32M|||
||_HASH_AREA_SIZE=8G|||
||_HASH_AREA_SIZE > 分区数 * 64K|性能较优||
|HASH GROUP分区数|最小1|性能提升||
||调整数据量和_HASH_AREA_SIZE大小验证不同分区数|||
||最大512|||
|AUTOTRACE|PartCount：分区数。,rowSetCount：第一阶段生成的RowSet数量。,TotalChunks：总共使用的页面数量。,EstimateDistinct：统计信息预估的distinct值。,RealDistinct：实际的distinct值。,TotalRows：参与hash group的数据行数。,MatRows：物化的数据行数。,SwapCount：发生换入换出的次数。,Dop：Combine并行度。,Is2PhaseAggr：是否采用了两阶段聚集。,CombineTime：Combine执行时间。|采用大数据量验证，观察AUTOTRACE打印打印与预期相符||
|复用用例|二层|结果与预期一致||
||asan|无泄漏||


### 3.2.2 DFX

|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具  
(sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|是|
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