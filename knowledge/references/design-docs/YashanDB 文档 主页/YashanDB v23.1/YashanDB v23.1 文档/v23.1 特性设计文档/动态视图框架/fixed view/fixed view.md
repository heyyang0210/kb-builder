Created by 孟凡彬, last modified on 七月 08, 2023

# 概念设计

fixed view是真正意义上的dynamic view，概念上dynamic view全称为dynamic performance view – 动态性能视图，其强调的是数据是动态变化的一类性能视图。

而fixed view的fixed体现的是另外一个维度的特征，其view的定义是固定的，不像普通user view可以修改，fixed view只能查询不能修改。

# 设计约束

- fixed view只能基于fixed table或者其他fixed view获取结果。
- 当前版本fixed view没有引入object id，后续根据具体外部诉求决定。
- fixed view本身没有权限控制，通过其他方式进行。


# 方案设计

fixed view本质上是一种视图，其主要包含V$和GV$两类，V$只查询本节点相关的数据，GV$对集群内所有节点进行数据汇聚。

## 详细设计

### fixed view定义

fixed view由于是内置的视图，其创建不能通过create view的方式创建，因此需要为每一个fixed view增加对应列别名信息。

其定义为内置的查询SQL语句，类似：

```
select xxx, xxx... from x$t1, x$t2 where ...;
```

### dc管理

dc新增fixed view类型，dc初始化时进行fixed view的注册，生成dict entry。

dc对应的fixed view时，根据获取到的定义SQL，进行view的解析和列检查。

### sql访问

在verify阶段，类似user view，需要对fixed view进行编译，生成对应的subQuery。

计划阶段，根据V$和GV$的不同，生成不同的计划，V$直接展开为subQuery查询计划，而GV$则生成tq merge计划。

执行阶段，V$已经被完全展开，最终访问的是fixed table，而GV$则进行算子下推，多节点执行汇总等，具体在GV$的设计中展开。

### 扩展规则

新增fixed view，只需要增加对应的列别名信息，以及定义的SQL即可。

注意：fixed view依赖的fixed table是必须存在的。

# 资料

fixed view属于对外可见的动态视图，如果有变更，需要填写对应的资料。

本特性修改v$instance视图，新增v$fixed_table，v$fixed_view_definition视图，需要同步补充资料。

  


