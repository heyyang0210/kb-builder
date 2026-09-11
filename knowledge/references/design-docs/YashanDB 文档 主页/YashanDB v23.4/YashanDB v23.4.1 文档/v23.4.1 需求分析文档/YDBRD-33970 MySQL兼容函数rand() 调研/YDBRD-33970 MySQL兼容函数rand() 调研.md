Created by 程康, last modified on 十一月 13, 2024

### 1、返回数据类型 - double    


![](https://pingcode.yasdb.com/atlas/files/public/6739e3ac8970c2af4f53a74f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWlBQUFBSUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQVFBQ0FBQUFJQUFnQ0FBQUJBQVVBQUFBQUFDQUFBQUFCQUFBQUJBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1MjYsImV4cCI6MTc4MjQ2NjMyNn0.r2df948ktbQLdRx9TBMVJQPiQ1JlrZNfCQ6IeSVN5gE)

### **2、seed 处理**

```
drop table if exists base;
create table base (c1 int, c2 bit, c3 double, c4 double(5,2), c5 decimal, c6 varchar(10));
insert into base values (1,1,123.123,214.4,1321,'1');
insert into base values (1,1,123.123,214.4,1321,'1.2');
insert into base values (1,1,123.123,214.4,1321,'1.8');
insert into base values (1,1,123.123,214.4,1321,'2.1');
truncate table base;

select rand(c6),rand(1),rand(2) from base;


select rand(2), rand(2.4), rand(2.9);
select rand(2), rand(3.1), rand(2.9);
```

**2.1 rand varchar，warning!!!**

![](https://pingcode.yasdb.com/atlas/files/public/6739e3ad8970c2af4f53a750/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWlBQUFBSUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQVFBQ0FBQUFJQUFnQ0FBQUJBQVVBQUFBQUFDQUFBQUFCQUFBQUJBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1MjYsImV4cCI6MTc4MjQ2NjMyNn0.r2df948ktbQLdRx9TBMVJQPiQ1JlrZNfCQ6IeSVN5gE)

**2.2 直接rand num 四舍五入**

**2.3 seed 规则**

```
drop table if exists t1;
create table t1(c1 int);
insert into t1 values (1),(2),(3);

SELECT RAND(3),rand(2),rand(1) FROM t1;

--
Returns a random floating-point value v in the range 0 <= v < 1.0. If a
constant integer argument N is specified, it is used as the seed value,
which produces a repeatable sequence of column values. In the following
example, note that the sequences of values produced by RAND(3) is the
same both places where it occurs.
```

**2.3 seed入参限制：20位 18446744073709551615 max uint_64**

![](https://pingcode.yasdb.com/atlas/files/public/6739e3ad8970c2af4f53a751/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWlBQUFBSUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQVFBQ0FBQUFJQUFnQ0FBQUJBQVVBQUFBQUFDQUFBQUFCQUFBQUJBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1MjYsImV4cCI6MTc4MjQ2NjMyNn0.r2df948ktbQLdRx9TBMVJQPiQ1JlrZNfCQ6IeSVN5gE)

**2.4 seed 叠加 不再随机 常量**

```
select rand();
select rand(rand());
select rand(rand(112));
select rand(rand(rand()));
select rand(rand(rand(rand())));
select rand(rand(rand(rand(100))));
```

![](https://pingcode.yasdb.com/atlas/files/public/6739e3ada1ad9a3311de25a1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWlBQUFBSUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQVFBQ0FBQUFJQUFnQ0FBQUJBQVVBQUFBQUFDQUFBQUFCQUFBQUJBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1MjYsImV4cCI6MTc4MjQ2NjMyNn0.r2df948ktbQLdRx9TBMVJQPiQ1JlrZNfCQ6IeSVN5gE)

### 参考

  [MySQL兼容函数差异调研文档 - 王博文 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=167180096)  

  [mysql rand()产生随机整数范围及方法 - 泽锦 - 博客园 (cnblogs.com)](https://www.cnblogs.com/zejin2008/p/4710364.html)  

## Attachments:

[image2024-10-29_15-23-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWUzYWE4OTcwYzJhZjRmNTNhNzQ3IiwicmVmX2lkIjoiNjczOWUzYWE3MjgyMDZlZmI5MzE2ZTNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTI2LCJleHAiOjE3ODI1NDE5MjZ9.9jF-daD9Z3mcTcb_MMZy8QKuTmo7O18JHRSaPBiH59Y)

 (image/png)    


[image2024-10-22_14-32-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWUzYWI4OTcwYzJhZjRmNTNhNzQ4IiwicmVmX2lkIjoiNjczOWUzYWE3MjgyMDZlZmI5MzE2ZTNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTI2LCJleHAiOjE3ODI1NDE5MjZ9.Oo6MCtiWW8BDd-WPW2PHmKs1HKpnH3k8qD5HiXFEeUw)

 (image/png)    


[image2024-10-23_9-59-52.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWUzYWI4OTcwYzJhZjRmNTNhNzQ5IiwicmVmX2lkIjoiNjczOWUzYWE3MjgyMDZlZmI5MzE2ZTNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTI2LCJleHAiOjE3ODI1NDE5MjZ9.XxNjdsVARECMXdR_SHwXsmiIRJfVrEpzVVNrb6B0XCE)

 (image/png)    


[image2024-10-23_10-0-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWUzYWJhMWFkOWEzMzExZGUyNTliIiwicmVmX2lkIjoiNjczOWUzYWE3MjgyMDZlZmI5MzE2ZTNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTI2LCJleHAiOjE3ODI1NDE5MjZ9.XO0QrcIUYeXNs4jSqLuXkSw_QDm6y2OLYGvQSDWlMBY)

 (image/png)    


[image2024-10-23_10-4-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWUzYWJhMWFkOWEzMzExZGUyNTljIiwicmVmX2lkIjoiNjczOWUzYWE3MjgyMDZlZmI5MzE2ZTNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTI2LCJleHAiOjE3ODI1NDE5MjZ9.vRqVfotmR1oz8rVaX7xy1UC3qPN-HNSv0LHp60H2mtM)

 (image/png)    


[image2024-10-29_9-7-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWUzYWM4OTcwYzJhZjRmNTNhNzRhIiwicmVmX2lkIjoiNjczOWUzYWE3MjgyMDZlZmI5MzE2ZTNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTI2LCJleHAiOjE3ODI1NDE5MjZ9.VIMvO5CsnY_kFUP4XM0JHn45G8UiYyzEf_RnJHpUSRQ)

 (image/png)    


[image2024-10-29_9-12-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWUzYWM4OTcwYzJhZjRmNTNhNzRiIiwicmVmX2lkIjoiNjczOWUzYWE3MjgyMDZlZmI5MzE2ZTNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTI2LCJleHAiOjE3ODI1NDE5MjZ9.kxP0v52-mllt9HcG2furhI5d7nE5AF1Yuac0JW9JNC8)

 (image/png)    


[image2024-10-29_9-13-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWUzYWNhMWFkOWEzMzExZGUyNTlkIiwicmVmX2lkIjoiNjczOWUzYWE3MjgyMDZlZmI5MzE2ZTNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTI2LCJleHAiOjE3ODI1NDE5MjZ9.HWQvsj36z4phqacRjCRAVpeIPzxrLs3Tfx4XQvaTSHo)

 (image/png)    


[image2024-10-25_14-32-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWUzYWNhMWFkOWEzMzExZGUyNTllIiwicmVmX2lkIjoiNjczOWUzYWE3MjgyMDZlZmI5MzE2ZTNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTI2LCJleHAiOjE3ODI1NDE5MjZ9.RnNOo5k-C-WqEnReToBnJbqSydwjuoyYKd-ujFfhdk8)

 (image/png)    


[image2024-11-8_15-49-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWUzYWNhMWFkOWEzMzExZGUyNTlmIiwicmVmX2lkIjoiNjczOWUzYWE3MjgyMDZlZmI5MzE2ZTNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTI2LCJleHAiOjE3ODI1NDE5MjZ9.yKDpQx5xMrfaHcTzZkZ8A8YBB6HdtbmlOEUciKJ6aic)

 (image/png)    
