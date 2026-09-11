Created by 孟凡彬, last modified by  徐千禧 on 一月 23, 2024

##   [1. Overview（概述）](#1-overview概述)  

在一些特定的场景下，用户希望可以通过SQL语句将不同源的数据合并到要目标表中，单纯的insert、update语句无法满足这种诉求，因此需要内核提供merge into语法的支持。

merge into是oracle兼容性方面的功能，其可以将源表的数据合并到目标表中，存在则更新，不存在则插入。基于这个点，merge into提供非常灵活的特性，如update和insert可以不同时出现在merge语法中，可以单独针对子句提供filter过滤能力。

##   [2. Features（功能特性）](#2-features功能特性)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c1ca1ad9a3311dc87c9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUVBQUJBQUFBQUFBQUFBQUlBRUFBQUFBQUFJQ0FBQUFBQUFJQUFBQUFBa0FBQUFnQUFBQkFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVNBQUFBQUFBQUFBQUFBQUFBQ1FBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBa0NRQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkwNjAsImV4cCI6MTc4MjMwOTg2MH0.b1PNHZP1AO_LsFUBMeJCHNwyiRLZ8EgoOG5PotI_vgg)

![](https://pingcode.yasdb.com/atlas/files/public/67396c1ca1ad9a3311dc87ca/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUVBQUJBQUFBQUFBQUFBQUlBRUFBQUFBQUFJQ0FBQUFBQUFJQUFBQUFBa0FBQUFnQUFBQkFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVNBQUFBQUFBQUFBQUFBQUFBQ1FBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBa0NRQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkwNjAsImV4cCI6MTc4MjMwOTg2MH0.b1PNHZP1AO_LsFUBMeJCHNwyiRLZ8EgoOG5PotI_vgg)

![](https://pingcode.yasdb.com/atlas/files/public/67396c1c8970c2af4f52095c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUVBQUJBQUFBQUFBQUFBQUlBRUFBQUFBQUFJQ0FBQUFBQUFJQUFBQUFBa0FBQUFnQUFBQkFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVNBQUFBQUFBQUFBQUFBQUFBQ1FBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBa0NRQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkwNjAsImV4cCI6MTc4MjMwOTg2MH0.b1PNHZP1AO_LsFUBMeJCHNwyiRLZ8EgoOG5PotI_vgg)

![](https://pingcode.yasdb.com/atlas/files/public/67396c1da1ad9a3311dc87cb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUVBQUJBQUFBQUFBQUFBQUlBRUFBQUFBQUFJQ0FBQUFBQUFJQUFBQUFBa0FBQUFnQUFBQkFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVNBQUFBQUFBQUFBQUFBQUFBQ1FBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBa0NRQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkwNjAsImV4cCI6MTc4MjMwOTg2MH0.b1PNHZP1AO_LsFUBMeJCHNwyiRLZ8EgoOG5PotI_vgg)

![](https://pingcode.yasdb.com/atlas/files/public/67396c1d8970c2af4f52095d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUVBQUJBQUFBQUFBQUFBQUlBRUFBQUFBQUFJQ0FBQUFBQUFJQUFBQUFBa0FBQUFnQUFBQkFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVNBQUFBQUFBQUFBQUFBQUFBQ1FBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBa0NRQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkwNjAsImV4cCI6MTc4MjMwOTg2MH0.b1PNHZP1AO_LsFUBMeJCHNwyiRLZ8EgoOG5PotI_vgg)

根据上述语法图，merge into要提供以下能力：

1. 支持指定update子句，并带有where过滤条件。
1. 支持指定insert子句，并带有where过滤条件。
1. 支持指定update delete子句，并带有where过滤条件。
1. 支持指定表分区进行merge操作。


##   [3. Interfaces（接口）](#3-interfaces接口)  

本方案不单独提供配置参数，或者接口，通过SQL语法提供功能。

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

- merge into的target table只能是个表，不支持对视图进行merge。
- merge into对target table的同一行不能更新两次。
- merge into支持对临时表、普通表、分区表进行merge。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

merge into的总体方案设计，尽量复用已有的SQL能力，将merge算子拆分为多个环节进行。

- 一方面，根据语句中的子句信息，复用已有的join算子；
- 另一方面，执行子句时遵循存储提供的update、delete、insert规范，执行语句内的DML操作。


###   [5.2 Merge Syntax Structure (merge语法结构)](#52-merge-syntax-structure-merge语法结构)  

merge语法结构包括几个方面：merge table、on filter、update clause、delete clause和insert clause。

####   [merge table](#merge-table)  

merge into的表有两类：source table和target table，target table是merge的目标表。source table是源表，其中原表可以是个视图/子查询/表。通过source和target进行join，作为结果集，根据结果集以及语句信息进行merge操作。

####   [on filter](#on-filter)  

on filter类似于join filter，其决定了merge动作是否被触发，on filter是个通用的filter，其在merge中承担了连接source和target的过滤条件。

####   [update clause](#update-clause)  

当满足on filter时，并且指定了update clause，此时会对DS上target table当前行执行update操作。由于一致性的约束，同一条语句同一行最多只能被更新一次。

update clause可以单独指定where过滤条件，这个update filter是作用于source或者target的，其相当于on filter的一个增强。

####   [delete clause](#delete-clause)  

delete clause属于update caluse的一部分，当没有指定update clause时，不能单独指定delete，指定delete语法要求指定delete filter，并作用于source或者target的，当满足条件时，会将当前target table对应的row删掉。其中delete删除行的filter是作用于target able update后的新值，而不是DS上查询到的旧值。有两种实现方式：

- 先执行update，执行完毕后，重新读取最新版本的值，exec delete Filter，判断是否需要delete，如果需要执行rollback savepoint，再重新读取历史版本行进行删除。
- 直接将delete filter中涉及到update column的改写为update set expr，执行update前，先执行lock only获取最新版本，然后执行改写后的delete filter，如果成功则删除数据，如果失败则执行update。


####   [insert clause](#insert-clause)  

当不满足on filter时，并且指定了insert clause时，此时会根据insert clause往target table中插入一行数据，由于此时DS上target table是NULL，因此insert where filter只作用于source table。

###   [5.3 Merge Parser (merge解析)](#53-merge-parser-merge解析)  

merge语法，属于特殊的DML。类似于delete, insert, update，需要单独写解析。

merge的DS解析和普通insert/update/delete不同，merge的DS来自于两个，一个是source table，一个是target table。

insert clause是否存在，决定DS上的两个表以哪种方式join。指定insert clause时为source left join outer target，当没有指定insert clause时，为target inner join source，这样可以借助后续的one row优化。

insert和update clause最少可以指定一个，允许同时指定。

默认进行DS解析时，认为这是个inner join，filter也是作为独立解析的。

###   [5.4 Merge Verifier (merge校验)](#54-merge-verifier-merge校验)  

####   [join改写](#join改写)  

校验阶段先重写source table和target table join的方式，因为此时知道了是否指定insert。

####   [校验子句](#校验子句)  

校验阶段要做一下几种类的校验：

- 校验on filter。
- 校验update clause的正确性，包括update filter，校验delete filter的正确性。
- 校验insert clause的正确性，包括insert filter。


校验update/insert时，需要根据insert/update语句本身的校验处理机制，调整insert column和update column的顺序。这些基础性的代码可以直接复用update/insert的能力。

####   [filter改写](#filter改写)  

进入rewrite阶段后，如果指定了delete clause，则触发merge filter规则改写，将delete clause中target table的column expr改写为set column expr。

###   [5.5 Merge Planner (merge计划)](#55-merge-planner-merge计划)  

####   [执行计划](#执行计划)  

创建执行计划时，会有一定的优化，类似于hash join的判断：

- filter条件必须严格满足column的等值判断，filter中不能存在非等值。
- 并且source和target上具有唯一索引，且唯一索引的列都在filter中。


当满足这些条件时，可以认为source中获取到的记录一定是stable的，此时不需要物化rowId。

总结来看不需要物化的rowId的场景有：

- 只有update clause，如果优化join的顺序后，当前join的内表是带有one row的，则不需要物化rowId。
- 当存在insert clause时，生成执行计划后，根据上述优化条件决定是否需要物化rowId。


###   [5.6 Merge Executor (merge执行)](#56-merge-executor-merge执行)  

merge into的执行类似于update/delete，由DS的scan驱动扫描，并根据扫描结果进行merge。

####   [merge update](#merge-update)  

当判断有update时，先执行update filter，如果不符合条件则跳过更新；否则进行重复更新检查。

如果有mat rowId，则插入到mat中，并检查唯一性，非唯一性报错。

执行update proc，并触发update行级触发器。执行update时会加锁，此时可能会触发重读最新版本，导致DS上的表数据发生变化。

- 一种是保持现状，这种情况理论上不会存在问题，因为当前行只会被match更新一次。
- 另外一种需要以select for update方式执行。


####   [merge delete](#merge-delete)  

当有delete时，在处理完mat rowId时，对行进行加锁，加锁后时带的是update filter。

加锁后还满足条件，则执行delete filter，如果delete filter满足条件则执行delete。

否则执行update proc。

####   [merge insert](#merge-insert)  

当判断有insert时，先执行insert filter，不符合条件则跳过插入；否则进入插入流程。

插入的实现与insert普通表类似，属于单条插入，后续可以优化为批量插入。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

###   [6.1 正常语法测试](#61-正常语法测试)  

- merge_insert
- merge_insert + insert_filter
- merge_update
- merge_update + update_filter
- merge_update + merge_delete
- merge_update + update_filter + merge_delete
- merge_update + merge_delete + delete_filter
- merge_update + update_filter + merge_delete + delete_filter
- merge_update + merge_insert
- merge_update + update_filter + merge_insert
- merge_update + merge_insert + insert_filter
- merge_update + update_filter + merge_insert + insert_filter
- merge_update + merge_delete + merge_insert + all filter


###   [6.2 异常语法测试](#62-异常语法测试)  

- 测试多个merge insert子句。
- 测试多个merge update子句。
- 测试没有merge insert, merge update子句。


###   [6.3 语义测试](#63-语义测试)  

- 测试source和target相同，on filter中出现相同列。
- 测试source和target相同，update column出现相同列。
- 测试source和target相同，update set/where中出现相同列。
- 测试source和target不同，update column出现source列。
- 测试source和target相同，insert column出现相同列。
- 测试source和target相同，insert value/where出现相同列。
- 测试source和target不同，insert value/where出现target列。


###   [6.4 表类型测试](#64-表类型测试)  

table, temp_table, part_table, view, subQuery, dynamic_view

###   [6.5 filter测试](#65-filter测试)  

- update_filter永真，永假
- delete_filter永真，永假
- insert_filter永真，永假
- delete_filter出现update列，出现source table, target table其他列。
- update filter出现source table, target table列。
- insert filter出现source table, target table列。


###   [6.6 key preserved测试](#66-key-preserved测试)  

主要针对source table是table, 是view或者subQuery场景。

###   [6.7 执行异常测试](#67-执行异常测试)  

- one row出现重复更新的情况
- 非key preserved情况下，出现重复更新的情况


##   [7. Document（资料）](#7-document资料)  

##   [8. Workload（工作量）](#8-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

1. ~~merge into on filter触发update时，可能会触发语句重启，后续执行器支持语句写一致性后再同步支持。~~    已支持。
1. ~~merge insert支持批量插入，后续批量插入支持时同步支持。~~   已支持批量插入。


## Attachments: