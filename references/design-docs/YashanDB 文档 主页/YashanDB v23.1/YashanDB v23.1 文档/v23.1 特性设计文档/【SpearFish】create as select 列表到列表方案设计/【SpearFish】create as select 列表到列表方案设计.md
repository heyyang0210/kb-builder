Created by 黄文早, last modified on 一月 18, 2024

## 1. Overview（概述）

  [https://jira.yasdb.com/browse/YDBRD-5251](https://jira.yasdb.com/browse/YDBRD-5251)  

## 2. Features（功能特性）

单机支持create as select 语句支持源表为列表，新表为列表

## 3. Interfaces（接口）

   语法参考     [https://conf.yasdb.com/pages/viewpage.action?pageId=76928352](https://conf.yasdb.com/pages/viewpage.action?pageId=76928352)  

## 4. Limitations（功能限制）

1. 不支持分布式
1. 行列表混合（子查询中表类型与新建表不一致）的情况下，都是走行执行引擎，不支持走列执行引擎
1. 不支持行列混合的insert（子查询中 中有行表和列表）
1. 其他限制与行存到列存，列存到行存 create as select 一致


## 5. Detail Design（详细设计）

   该需求存储只做放开，具体实现子查询逻辑参考     [https://conf.yasdb.com/pages/viewpage.action?pageId=112725612](https://conf.yasdb.com/pages/viewpage.action?pageId=112725612)     。

## 6. Testcases（自测用例）

增加基本创建用例与功能限制用例

## 7. Document（资料）

无

## 8. Workload（工作量）

3

## 9. TODO（遗留问题）

无