Created by 李坤宇, last modified on 九月 10, 2024

原逻辑限制：

1. 集合操作：只要集合操作的投影或上拉的filter中含有ref，则不能解关联
1. view：view中一旦出现外部引用就不能解关联。


现规则：

1. 集合操作：


- 如果没ref或投影中有ref，与原有逻辑一致；
- filter中有ref时，集合操作只允许在filter in/not in/exists/not exists子查询四种情况下进行解关联
- 上拉的filter必须满足以下条件：
-     1. 只能是filter equal
    1. filter两边必须是一边是ref，另一边是kernel column
    1. 集合操作每个孩子上拉的filter个数必须相同
    1. 每个孩子的上拉filter中的ref必须一一对应，出现顺序允许不同，也允许重复出现，但是必须一一对应。例如 col1 = ref1 and col2 = ref2 union  col1 = ref2 and col2 = ref2这种就不行，因为有一个ref1和ref2没对应上。

-  


      2. view：

- 如果没ref，与原有逻辑一致；
- 有ref时，且是单表查询，可以解关联。


  


