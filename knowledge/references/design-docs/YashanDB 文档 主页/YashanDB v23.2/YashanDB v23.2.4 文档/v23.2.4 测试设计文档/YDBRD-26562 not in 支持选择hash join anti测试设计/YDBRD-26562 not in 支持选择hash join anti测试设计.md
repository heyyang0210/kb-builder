Created by 马文英, last modified on 七月 11, 2024

# 1. 概述

*not in 支持 hash join anti类算子优化*

# 2. 需求分析

## 2.1 功能点分析

- not in 为已支持语法，无新增语法；
- 左边的数据不在右边数据集合中时结果为FALSE
- NOT IN：    
  * 如果左边数据为NULL：结果为FALSE (  右边为空（子查询返回0行记录  ）可以返回结果)


          * 如果右边集合中含有NULL值，则返回FALSE 

Unknown macro: { from t1 where a not in( select b from t2 where t2.c=t1.d)}

          * 如果右边集合中不含NULL值，且所有数据与左边数据不相等，则结果为TRUE，否则为FALSE

- 新增八个个算子  hash join anti NA / hash join anti SNA / hash right anti NA / hash right SNA / 


                                      nestloop anti na / nestloop anti sna / merge anti na / merge anti sna

            （  其中 SNA类算子在当前版本中选不到   ）

- 优化器通过cost在以下算子中选择 
    - hash join anti / hash join anti NA / hash join anti SNA
    - hash join right anti  / hash right anti NA / hash right anti SNA
    - nest loop anti / nestloop anti na / nestloop anti sna
    - merge join anti / merge join anti na / merge join anti sna              (  merge join anti在文档中没有找到  )
- ~~非null 时选择anti join~~     ~~根据表定义中列的 not null属性判断~~  ，无法根据索引，谓词做判断 (  非关联全部走NA,关联全部走anti  )
- 列存天然支持以上算子 ?(不在本次范围，  分布式行执行 dev合入后SIT加固  )


## 2.2 应用场景

- 右边可能出现null的情况下可以选到 hash join anti , 提高执行的效率
- 需要测试not in 两种语法场景
- 产品形态：单机，集群，分布式


## 2.3 规格约束

- *  (*  *非关联全部走NA,关联全部走anti*  *) *  ~~* 根据表定义中列的 not null属性判断，无法根据索引，谓词做判断  *~~
- SNA类算子本次实现无法选到
- invert谓词在本次实现后会去掉，算子直接根据谓词做判断 （  只有antijoin有invert, NA时没有invert  ）
- 只支持行执行


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

1. *每条语句测试时需要通过explain执行计划，确认确实走到了期望的算子*


|编号|场景|测试点|测试点特征|备注|
|---|---|---|---|---|
|1|in 谓词|单列|a1 in (select b1 from t)|  
|
|  
|  
|多列|a1,a2 in (select b1,b2 from t)|  
|
|  
|  
|列的数据类型|数值，字符，日期，大对象，自定义类型。。。|简单覆盖一下|
|  
|  
|列表达式|表中的原始列,表达式 （比如 a+b, 函数。。。）,  
|  
|
|  
|  
|取值|数据中有null|原始数据中有NULL,投影列表达式结果有null,多列时，部分列有null, 或全部列为null,所有数据都为null,以下列在join时可能补空,列存在not null约束,列是主键,列在主键中|
|  
|  
|  
|数据中无null|根据表属性无法判断，需要根据谓词索引的场景|
|  
|  
|  
|数据中无null|列存在not null约束,列是主键,列在主键中|
|  
|  
|  
|  
|  
|
|2|in 中的子查询|单表子查询|  
|左右单边有null    
  左右双边有null|
|  
|  
|多表子查询|  
||
|  
|  
|非关联子查询|  
||
|  
|  
|关联子查询|  
||
|3|in左边的谓词|来自表|select * from (user view) sub.a ||
|  
|  
|来自子查询|  
||
|  
|  
|左边有数据带null，右边是空集|null可返回|  
|
|4|算子|hash join|hash join anti,hash join anti NA,hash join anti SNA|场景1，2，3 需要覆盖三个算子,SNA算子根据oracle可以到的语句补充,*(*  *非关联全部走NA,关联全部走anti*  *)*,*投影列：select count(*) ，count(a)*|
|  
|  
|hash right|hash right anti,hash right anti NA,hash right anti SNA|场景1，2，3 需要覆盖三个算子,SNA算子根据oracle可以到的语句补充,*投影列：select count(*) ，count(a)*|
|  
|  
|nest loop |nest loop anti,nest loop anti NA,nest loop anti SNA|场景1，2，3 需要覆盖三个算子,SNA算子根据oracle可以到的语句补充|
|  
|  
|merge join |merge join  anti,merge join  anti NA,merge join  anti SNA|场景1，2，3 需要覆盖三个算子,SNA算子根据oracle可以到的语句补充|
|  
|  
|算子组合|多个 join 算子同时出现|  
|
|5|  
|执行计划|现有join中的invert谓词取消|antijoin保留 |
|6|性能测试（单算子性能）|  
|增加单算子性能看护用例|  
|
|  
|  
|  
|cost|通过hint 对比 hash/ nest loop/ merge的性能，测试cost是合理|
|7|部署模式|单机行存|  
|  
|
|  
|  
|分布式LSC|  
|不支持,分布式行执行（SIT根据分布式支持行执行进展定）|
|  
|  
|集群|  
|  
|
|8|CT|  
|补充hash join 和 merge join类算子用例|补充NA|
|  
|  
|  
|  
|  
|
|9|~~not exists~~|  
|  
|  
|


  


1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|否|
|长稳|是|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|是 sqlsmith|
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



## Comments:

|  [](null)  ,评审纪要：,非关联全部走NA,关联全部走anti,投影列：select count(*) ，count(a),以下列在join时可能补空,列存在not null约束  ,   列是主键  ,   列在主键中,In   右边为空（子查询返回  0  行记录  ),Posted by mawenying at 七月 16, 2024 11:31|
|---|
