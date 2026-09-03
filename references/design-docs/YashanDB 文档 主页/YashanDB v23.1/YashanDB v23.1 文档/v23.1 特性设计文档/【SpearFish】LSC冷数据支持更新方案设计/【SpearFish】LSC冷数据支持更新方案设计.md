Created by 黄文早, last modified on 十月 31, 2023

  [YDBRD-11784](https://jira.yasdb.com/browse/YDBRD-11784?src=confmacro)    -  【2023.1】LSC表的SCOL数据支持更新  完成

#   [LSC 冷数据支持更新方案设计](#lsc-冷数据支持更新方案设计)  

##   [1. Overview（概述）](#1-overview概述)  

​	更新作为数据库的基本能力，目前lsc只支持热数据的更新，但是对于冷数据，还是会有少量数据的更新需求。因此lsc需要提供冷数据更新的能力。

##   [2. Features（功能特性）](#2-features功能特性)  

​		lsc  冷数据支持更新

##   [3. Interfaces（接口）](#3-interfaces接口)  

​		无

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

1. 不支持多表update
1. 分布式不支持列表update/delete带子查询，限制了本SR在分布式下的表现
1. 不支持执行slice update
1. 行锁放大到slice 级别，锁冲突增大
1. 未打开row movement，不允许更新冷数据，打开row movement 发生更新冲突语句重启
1. lsc 表的row movement 默认配为enable
1. 禁止lob更新


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

​	lsc表更新的实现方法为：将冷数据中的行删除，并将更新后的行插入到热数据中。

事务控制为冷数据的删除的事务控制。

#####   [具体实现](#具体实现)  

​		当前更新时列数据分为 sacn column、update column，但是这两部分不并不包括表的所有列，因此需要额外读取一部分列。并且，为了保证插入数据的效率，执行时将一部分update/scan的行缓存下来。缓存到一定数量后去fetch 对应的数据。合并缓存的数据，再执行插入，缓存数量为63行。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

​	增加更新ut用例测试冷数据更新接口。

逻辑日志delete + insert

##   [7. Document（资料）](#7-document资料)  

无

##   [8. Workload（工作量）](#8-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

​	分布式放开row movement后测试