Created by 林博, last modified on 十一月 03, 2023

IR链接：    [YDBRD-11538](https://jira.yasdb.com/browse/YDBRD-11538?src=confmacro)    -  列存窗口函数支持Hash分区  完成    
  SR链接：    [YDBRD-21505](https://jira.yasdb.com/browse/YDBRD-21505?src=confmacro)    -  列存计算窗口函数支持Hash分区  完成

## 1. Overview（概述）

该需求来源于TPCDS和深圳通业务场景，需要支持的部署形态包括单机和分布式。

![](https://conf.yasdb.com/download/attachments/133580003/image2023-10-30_19-11-38.png?version=1&modificationDate=1698664039000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQ2dBQUFBQUFBQkFBQUFBQUFBQUNBQUFBQUFBQVFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUlBQkFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFFUUFBUUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA5MzcsImV4cCI6MTc4MjMxMTczN30._7oghPf8hR2IDud0ZTLqJLorIFIVjJZEh24ht0KRYgY)

当前窗口函数的实现基于排序实现，Partition By和Order By使用同一个排序，这样会导致排序的计算量很大。如果第一个Partition By用hash，可以加快分区速度，只有Partition By的场景，用hash也是更加快的。

![](https://pingcode.yasdb.com/atlas/files/public/67396c738970c2af4f520c2e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQ2dBQUFBQUFBQkFBQUFBQUFBQUNBQUFBQUFBQVFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUlBQkFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFFUUFBUUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA5MzcsImV4cCI6MTc4MjMxMTczN30._7oghPf8hR2IDud0ZTLqJLorIFIVjJZEh24ht0KRYgY)

## 2. Features（功能特性）

窗口函数算子支持hash分区，不依赖下层数据是否已经排序。

## 3. Interfaces（接口）

```
enum WindowImplType {
	Sorted,
	Hash
}

pub fn window<OP: Into<BoxedOperator>>(
    child: OP,
    projection: Vec<Box<dyn Expression>>,
    win_funcs: Vec<WindowFunction>,
    agg_win_funcs: Vec<Box<dyn AggregateExpr>>,
    partition_keys: Vec<Box<dyn Expression>>,
    sort_keys: Vec<SortKey>,
    win_frame: WindowFrame,
    material_quota: usize,
	ty: WindowImplType
) -> Result<Box<dyn Operator>> {
    Ok(Box::new(Window::try_new(
        child.into(),
        projection,
        win_funcs,
        agg_win_funcs,
        partition_keys,
        sort_keys,
        win_frame,
        material_quota,
		ty,
    )?))
}
```

## 4. Specification And Constraints（规格与约束）

规格：

- 与之前一致：    [Window Operator Design](/pages/createpage.action?spaceKey=YAS&title=Window+Operator+Design)  


约束：

1. 不支持Filter
1. Window Frame不支持Groups模式
1. 不支持exclusion特性
1. Offset只支持常量


## 5. Detail Design（详细设计）

### 5.1 Architecture（架构）

窗口函数中的Partition By实现与Group By类似，但不完全相同。Partition By分区后的数据需要保存下来，进行分区之后，如果还有Order By，需要对分区数据进行排序。

需要考虑：1）在分区时就对分区内的数据进行排序；2）分区完之后再对数据进行排序；同时进行分区和排序应该是最快的，但是因为每次排序都会涉及到排序内存的分配，所以我们采取折中的方案，就是3）在分区的过程中，只对第一个分区的数据进行排序，其他分区的数据直接写缓存。

缓存分区数据涉及缓存到内存中或者文件中，只有当内存不够的情况下，才会写数据到文件中。

### 5.2 Data Structures & Flow（数据结构与流程）

**5.2.1 数据结构**

排序使用的结构体：

- HybridSorter：对当前分区的数据进行排序。可以重用，每次开启新的分区，重置该结构体；


第一个分区使用的ColumnBuilderSet：

- ColumnBuilderSet：单独缓存第一个分区的数据，ColumnBuilderSet填满一个ColumnSet后，直接放到HybridSorter中进行排序；


其他独立分区数据存储：

- Vec<(ColumnBuilderSet, ColumnSetStore)>：其中，ColumnBuilderSet缓存不满的ColumnSet，每满一个ColumnSet，就向Vec<ColumnSetStore>对应的ColumnSetStore中write一个；ColumnSetStore存储其他分区的数据，分区数据无序；以分区ID为下标从Vec中取指定分区的ColumnSetStore>；
- 出现新的分区，需要初始化新的ColumnSetStore/ColumnBuilderSet，push到Vec<(ColumnBuilderSet, ColumnSetStore)>中。


考虑极端场景：分区个数特别多时，Vec<(ColumnBuilderSet, ColumnSetStore)>这个Vec本身使用的内存就会特别大，无法保存到内存中。这时需要限制Vec<(ColumnBuilderSet, ColumnSetStore)>的最大元素个数（受内存配额影响，假设达到内存配额影响时，Vec长度为MAX_P，后续文中出现达到MAX_P即表示达到内存配额），当达到MAX_P时，不再为每个新的分区创建初始化新的ColumnBuilderSet/ColumnSetStore。超过MAX_P的分区使用同一个ColumnBuilderSet/ColumnSetStore。对于这些分区，在后续执行过程中，需要重新进行分区，所以极端场景下性能可能会很差。

- Option<(ColumnBuilderSet, ColumnSetStore)>：缓存超过MAX_P的分区的数据；


  


开启新的分区时，按照  **第一个分区 → Vec<(ColumnBuilderSet, ColumnSetStore)> → Option<(ColumnBuilderSet, ColumnSetStore)>的优先级**  开启分区。

  


**优化点：**

- **将Vec<(ColumnBuilderSet, ColumnSetStore)>按照数据量排序，优先开启数据量较少的分区，在外层带limit的场景下应该有性能优化。**
- **极端场景下：是否可以把每行数据所属的分区构造一个列，拼成新的ColumnSet再缓存，这样在重新分区时，不需要再次计算所属分区，但是会增加内存消耗或写盘数据量；（先不做）**


  


```
const MAX_PENDING_PARTITION_NUM: usize = xxx;  // 结合内存配额一起控制pending_partitions的最大元素个数

struct HashWindowCursor {
	schema: Arc<Schema>,
    child: Box<dyn Cursor>,
        
    projection: Vec<Box<dyn BoundExpr>>,
    win_funcs: Vec<Box<dyn BoundWindowFunc>>,
    win_agg_func_set: WinAggFuncSet,
        
    curr_partition: HybridSorter<TempFile>,
    curr_column_builder_sets: ColumnBuilderSet,
    pending_partitions: Vec<HashWindowPartition>,
    other_partitions: Option<HashWindowPartition>,
    // ...
}

struct HashWindowPartition {
    col_builder_sets: ColumnBuilderSet,
    col_set_store: ColumnSetStore,
    // ...
}
```

**5.2.2 Hash窗口算子执行流程**

- 步骤1：将孩子节点数据作为数据源，
- 步骤2：从数据源取数，进行Hash分区，分开存储各个分区的数据，分区过程中对第一个分区的数据进行排序
    - 2.1 从数据源取一个ColumnSet，计算partition字段，进行分区（类似HashGroupContext::execute_group_by_without_invalid逻辑），分区完成后，每行数据所属分区会临时记录到group_ids(Vec<usize>)中；
    - 2.2 根据group_ids将每行数据添加到对应的ColumnBuilderSet中（超过MAX_P的分区数据添加到共用的ColumnBuilderSet中）。ColumnBuilderSet满一个ColumnSet时，生成ColumnSet，如果是第一个分区，输入到HybridSorter进行排序。如果是其他分区的数据，将生成的ColumnSet以group id作为下标添加到Vec<(ColumnBuilderSet, ColumnSetStore)>中；如果是超过MAX_P的分区数据，添加到共用的Option<(ColumnBuilderSet, ColumnSetStore)>中，
    - 2.3 返回2.1，接着取数据，进行分区。数据取完之后，将各个ColumnBuilderSet中的数据生成ColumnSet，添加到2.2中描述的存储位置中。
- 步骤3：开启一个分区，初始化相关信息；
- 步骤4：如果是独立分区，进行步骤5；如果是超过MAX_P的分区，进行步骤6；
- 步骤5：遍历该分区，取一个ColumnSet；
    - 5.1 如果是第一个分区，该分区数据存储在HybridSorter中，从HybridSorter中遍历数据；如果是其他分区数据，该分区数据存储在ColumnSetStore中，先从ColumnSetStore取数据输入到HybridSorter中进行排序；
    - 5.2 从HybridSorter取排好序的数据，取得到数据时，进行步骤7；
    - 5.3 从该分区取不到数据时，切换分区，如果没有剩余分区，算子执行结束。否则，返回步骤3；
- 步骤6：（极端场景：对存储在一起的数据重新分区）将Option<(ColumnBuilderSet, ColumnSetStore)>作为数据源，进行步骤2；
- 步骤7：计算非聚集函数的结果；
- 步骤8：计算聚集函数的结果；
- 步骤9：删除分区中不再需要的数据，返回步骤4；


计算聚集函数过程中，现有实现已有如下优化：

- 如果窗口所包含的行和上次计算的行完全相同，直接取上次计算的结果。
- 如果窗口函数之前的结果可以利用，就利用之前的计算结果（如果聚集计算有反操作，比如sum）


![](https://pingcode.yasdb.com/atlas/files/public/67396c748970c2af4f520c2f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQ2dBQUFBQUFBQkFBQUFBQUFBQUNBQUFBQUFBQVFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUlBQkFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFFUUFBUUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA5MzcsImV4cCI6MTc4MjMxMTczN30._7oghPf8hR2IDud0ZTLqJLorIFIVjJZEh24ht0KRYgY)

**5.2.3 内存控制**

上述执行过程中，使用内存较多的地方如下几点：

- HybridSorter
- ColumnBuilderSet
- ColumnSetStore
- Vec<(ColumnBuilderSet, ColumnSetStore)>


其中，ColumnBuilderSet用来构造ColumnSet，只能存到内存中。ColumnSetStore和HybridSorter都是会先将ColumnSet缓存到内存中，内存不足时触发写盘。

内存控制本质上控制的是ColumnSetStore和HybridSorter的可用缓存大小以及Vec<(ColumnBuilderSet, ColumnSetStore)>本身使用内存大小，控制什么时候触发写盘。

  


**内存使用原则：**  优先保证当前分区的数据能够保存到内存中，即HybridSorter在内存中进行排序；

**内存配额：**  上述结构体共用一个内存配额：Arc<OperatorQuota>。

**总缓存内存大小：**  ColumnBuilderSet数量 * 每个ColumnSet大小 + HybridSorter缓存内存大小 + Σ(每个ColumnSetStore内部缓存的ColumnSet数量 * 每个ColumnSet大小) + Vec<(ColumnBuilderSet, ColumnSetStore)>使用内存大小

![](https://pingcode.yasdb.com/atlas/files/public/67396c74a1ad9a3311dc8a9c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQ2dBQUFBQUFBQkFBQUFBQUFBQUNBQUFBQUFBQVFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUlBQkFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFFUUFBUUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA5MzcsImV4cCI6MTc4MjMxMTczN30._7oghPf8hR2IDud0ZTLqJLorIFIVjJZEh24ht0KRYgY)

**关键执行点：**

- 产生新的分区时，需要向 Vec<(ColumnBuilderSet, ColumnSetStore)>添加新分区相应接结构体。判断总缓存内存大小是否达到内存配额上限，达到时不再添加新的结构体，新分区数据添加到共用的Option<xxx,xxx>结构中；


- ColumnBuilderSet满一个ColumnSet时：
    - 如果不是第一个分区的数据，将ColumnSet写到对应的ColumnSetStore中。ColumnSetStore内部优先缓存到内存中，总缓存内存大小达到内存配额上限时，触发写盘（将当前ColumnSetStore的全部缓存数据写盘）；
    - 如果是第一个分区的数据，将ColumnSet写到HybridSorter中。HybridSorter内部优先缓存到内存中，总缓存内存大小达到内存配额上限时，触发写盘（将所有其他分区对应的ColumnSetStore的缓存数据写盘）；


**编码细节/优化点：**

- transform时，为当前算子根据估算内存调整column_bulk_size；
- 出现新分区，不要直接创建ColumnSetStore，而是在ColumnBuilder第一次满一个ColumnSet时，再触发创建；
- 每个ColumnBuilder不要直接使用估算调整的column_bulk_size作为capacity，可以小一点，每满一个ColumnSet，适当增加capacity，最大设置为column_bulk_size；
- HybridSorter/ColumnSetStore结构体目前会存一个Arc<OperatorQuota>，需要增加接口，做整体协调控制；


**相关参数：**

- Columnar_Vm_Buffer_Size：控制列计算过程中最大可用内存；
- COLUMNAR_MAX_OPERATOR_MEM_PERCENT：控制列计算过程中单个OPERATOR最大可用内存
- COLUMNAR_MATERIAL_PERCENT：控制列计算过程中可用物化内存上限；


### 5.3 Compatibility（兼容性）

不影响兼容性

### 5.4 DFX设计

- Autotrace中输出内存使用情况，具体为OperatorQuota::trace_string()中构造的内容：


**"name {} id: {}, estimate {}, up_level {} low_level {} current {} share_num {} max used {} min up level {} expend {}"**

- 相关Metrics


### 5.5 其他

无

## 6. Testcases（自测用例）

表6-1

|分类|测试场景|测试内容|
|---|---|---|
|功能测试|无数据|10个函数(详见表6-2)、与Partition by、Order by、带/不带Window Frame、带/不带Distinct的组合；|
|  
|数据分区均衡|10个函数(详见表6-2)、与Partition by、Order by、带/不带Window Frame、带/不带Distinct的组合；|
|  
|数据分区不均衡|10个函数(详见表6-2)、与Partition by、Order by、带/不带Window Frame、带/不带Distinct的组合；|
|性能测试|对比测试|对比相同场景下Hash实现和Sort实现的性能；|
|极端场景测试|数据量极大|关注结果正确性、性能表现；|
|  
|数据分区极不均衡|关注结果正确性、性能表现；|
|  
|分区数极多|关注结果正确性、性能表现；|


表6-2

|类型|窗口函数名称|功能说明|
|:---|:---|:---|
|排名类窗口函数|ROW_NUMBER()|返回每一行在分区内或整个结果集中的序号，从1开始。如果分区内有多行具有相同的排序值，则序号是任意分配的。|
||RANK()|返回每一行在分区内或整个结果集中的排名，从1开始。如果分区内有多行具有相同的排序值，则它们具有相同的排名，并且下一个排名跳过相同排名的数量。|
|分析类窗口函数|LAG(expr, offset, default)|返回分区内或整个结果集中，当前行之前的第offset行的expr值，如果没有这样的行，则返回default值。如果省略offset，则默认为1。如果省略default，则默认为NULL。|
||LEAD(expr, offset, default)|返回分区内或整个结果集中，当前行之后的第offset行的expr值，如果没有这样的行，则返回default值。如果省略offset，则默认为1。如果省略default，则默认为NULL。|
||FIRST_VALUE(expr)|返回分区内或整个结果集中，按照排序规则的第一行的expr值。|
|聚合类窗口函数|SUM(expr)|返回分区内或整个结果集中，expr的总和。|
||AVG(expr)|返回分区内或整个结果集中，expr的平均值。|
||MIN(expr)|返回分区内或整个结果集中，expr的最小值。|
||MAX(expr)|返回分区内或整个结果集中，expr的最大值。|
||COUNT(expr)|返回分区内或整个结果集中，expr的总行数。|


## 7.资料设计章节

计划新增WindowHash Plan

## 8. TODO（遗留问题）

考虑单机并行以及分布式并行

## Attachments:

[image2023-10-31_15-35-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNzM4OTcwYzJhZjRmNTIwYzJiIiwicmVmX2lkIjoiNjczOTZjNzM1OTNmOTljOWZmMjM2ZTlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwOTM3LCJleHAiOjE3ODIzODczMzd9.gqs2MTmrOo4An1m5KVPLeFEkDXUxPk44vdTgxrav5Jw)

 (image/png)    


[image2023-11-3_16-27-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNzM4OTcwYzJhZjRmNTIwYzJkIiwicmVmX2lkIjoiNjczOTZjNzM1OTNmOTljOWZmMjM2ZTlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwOTM3LCJleHAiOjE3ODIzODczMzd9.cAHvuSN27PrDQ-rnyEXRTFtuTL-k9GdbjuEwSbvZ6dw)

 (image/png)    


[image2023-11-3_16-27-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNzNhMWFkOWEzMzExZGM4YTlhIiwicmVmX2lkIjoiNjczOTZjNzM1OTNmOTljOWZmMjM2ZTlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwOTM3LCJleHAiOjE3ODIzODczMzd9.YPhZaj4J-k3hZ-qTevcL1yBKpNNzw04Rh8HhfyCc55A)

 (image/png)    


## Comments:

|  [](null)  ,1. MAX_P怎么配置或能查询出？
1. 这个特性是否只有创建窗口函数带partition才有效？
1. 并行度是否有影响?
,Posted by shixinhua at 十一月 03, 2023 14:58|
|---|
|  [](null)  ,窗口函数Window frame中的offset支持绑定参数；,limit offset语句中不支持绑定参数，仅支持常量；,  点击此处展开...,```
drop table if exists t1;
create table t1(a int) organization tac;
insert into t1 values(1);
insert into t1 values(2);
insert into t1 values(3);
commit;

create or replace function udf_test_02(arg1 in int) return varchar is
res varchar(200);
begin
select a into res from t1 limit 1 offset arg1;
return res;
end;
/

select udf_test_02(1) from t1;

create or replace function udf_test_03(arg1 in int) return varchar is
res varchar(200);
begin
select first_value(a) over(order by a rows between arg1 preceding and arg1 following) into res from t1 where a = 1;
return res;
end;
/

select udf_test_03(1) from t1;
```,  
,  
,Posted by linbo at 十一月 03, 2023 17:13|
