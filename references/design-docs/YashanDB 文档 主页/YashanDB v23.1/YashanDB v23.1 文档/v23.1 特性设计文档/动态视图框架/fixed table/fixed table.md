Created by 孟凡彬, last modified on 七月 08, 2023

# 概念设计

fixed table是一种新的表类型，其类似当前版本的dynamic view，当前版本的dynamic view本质上是一种dynamic table。其固定是定义的，数据是动态的，并且fixed table存在一定的约束。

- fixed table是一种本地表，只反馈本实例的实时数据信息。
- fixed table只支持查询，不支持数据的修改和元数据的修改。


fixed table所属用户为sys用户，主要作为fixed view基表使用。

# 设计约束

- 根据fixed table的概念，其在主备机、分布式、集群下都是支持的，查询的是本运行实例的数据。
- 当前版本fixed table没有引入object id，后续根据具体外部诉求决定。
- fixed table只归属于sys用户，默认情况下，其他用户没有操作权限。


# 方案设计

fixed table与dynamic view类似，需要定义fixed table column信息，提供对应的访问接口。

fixed table默认其他用户不可见，且不在系统表中定义接口，其结构通过硬编码方式定义；fixed table的命名以X$开头。

## 游标接口

下面定义fixed table统一对外的访问接口

|接口|含义|
|---|---|
|ftOpenCursor|打开、初始化fixed table游标|
|ftFetchCursor|调用fixed table的查询接口，返回数据|


## 详细设计

### fixed table定义

fixed table的定义在对应的fixed table文件中，定义对应的ftColumn信息，以及对应open和fetch函数。这里与现在的dynamic view是非常类似的，不详细展开。

### dc管理

dc新增fixed table对象类型，为了与当前的dynamic view做区分，并且新增对应的注册entry接口，以及加载fixed table dict接口。

### 访问控制

SQL verify kernel table时拿到对应的table desc，获取dict type为fixed table，并对fixed table的操作进行检查校验，不支持的能力进行报错。

### 扩展规则

新增fixed table，只需要在fixed table文件中增加对应的ftColumn以及open fetch函数即可。原则是fixed table的实现尽量简洁明了。

# 资料

fixed table不属于对外公开的固定表，因此不提供资料信息。但通过v$fixed_table可以查询到当前所有fixed table信息。

  


