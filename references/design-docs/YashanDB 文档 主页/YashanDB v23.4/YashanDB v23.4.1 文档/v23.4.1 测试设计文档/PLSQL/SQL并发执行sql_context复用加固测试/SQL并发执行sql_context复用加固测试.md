

并发用例设计



1、静态DML语句，values值为常量，insert into tb1 values(1);

2、动态DML语句，values值为常量，带绑定参数，execute immediate 'insert into tb1 values(:1)' using 1;

3、动态DML语句，values值为常量，无绑定参数，execute immediate 'insert into tb1 values(1)';

4、静态DML语句，values值为变量，insert into tb1 values(a);

5、动态DML语句，values值为变量，带绑定参数，execute immediate 'insert into tb1 values(:1)' using a;

6、动态DML语句，values值为变量，无绑定参数，execute immediate 'declare a int; begin insert into tb1 values(a); end';

7、静态into语句，投影列，where values值为常量，select 1 into v from tb1 where c1 = 1;

8、动态into语句，投影列，where values值为常量，带绑定参数，execute immediate 'select :1 from tb1 where c1 = :2' into v using 1, 1;

9、动态into语句，投影列，where values值为常量，无绑定参数，execute immediate 'select 1 from tb1 where c1 = 1' into v;

10、动态执行匿名块into语句，投影列，where values值为常量，带绑定参数，execute immediate 'declare a int;begin select :1 into v from tb1 where c1 = :2'  using 1, 1;end';

11、动态执行匿名块into语句，投影列，where values值为常量，无绑定参数，execute immediate 'declare a int;begin select 1 into v from tb1 where c1 = 1';end';



10、静态into语句，投影列，where values值为变量，select a into v from tb1 where c1 = a;

11、动态into语句，投影列，where values值为变量，带绑定参数，execute immediate 'select :1 from tb1 where c1 = :2' into v using a, a;

12、动态into语句，投影列，where values值为变量，无绑定参数，execute immediate 'declare a int; b int; select a into v from tb1 where c1 = b;end';

13、静态into语句，投影列为字段，where values值为变量，select c1 into v from tb1 where c1 = a;

14、动态into语句，投影列为字段，where values值为变量，带绑定参数，execute immediate 'select c1 from tb1 c1 = :1' into v using a;

15、动态into语句，投影列为字段，where values值为变量，无绑定参数，execute immediate 'declare a int; select c1 into v from tb1 c1 = a;end';

16、fetch into 



DML：values()多个值 insert into tb1 values record;

into: select 1,'a' into record from tb1 where c1 = 1;

