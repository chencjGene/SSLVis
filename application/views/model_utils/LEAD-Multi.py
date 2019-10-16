import numpy as np
from sklearn import datasets
from sklearn.semi_supervised import LabelPropagation
from sklearn.semi_supervised import LabelSpreading
from sklearn.metrics import accuracy_score
from sklearn.neighbors import KNeighborsClassifier
from sklearn.svm import SVC


#GSSL predictions
def gssl(data, labels, label_index, unlabel_index):
    label_prop_model = LabelPropagation()
    label_prop_model.fit(data, labels)
    predict_prop = np.zeros((len(labels), ))
    predict_prop[label_index] = labels[label_index]
    predict_prop[unlabel_index] = label_prop_model.predict(iris.data[unlabel_index])


    label_spred_model = LabelSpreading()
    label_spred_model.fit(iris.data, labels)
    predict_spred = np.zeros((len(labels), ))
    predict_spred[label_index] = labels[label_index]
    predict_spred[unlabel_index] = label_spred_model.predict(iris.data[unlabel_index])

    gssl_value = np.stack([predict_prop, predict_spred], axis=1)

    return gssl_value

def baseline(sup_data, sup_target, unsup_data):

    knn = KNeighborsClassifier(n_neighbors=1)
    knn.fit(sup_data, sup_target)
    baseline_predict = knn.predict(unsup_data)
    return baseline_predict

def LEAD(gssl_value, unlabel_index):
    y_hat = np.floor(np.mean(gssl_value, axis=1)).astype(int)

    C_1 = 1
    C_2 = 0.01

    # update w
    while (C_2 < C_1):
        weights = np.ones((len(y_hat),))
        weights[unlabel_index] = C_2
        svm = SVC(kernel='linear')
        svm.fit(gssl_value, y_hat, weights)

        y_hat[unlabel_index] = svm.predict(gssl_value[unlabel_index])

        C_2 = 2 * C_2

    return y_hat

if __name__ == "__main__":

    # get toy multi-class data
    np.random.seed(4)
    iris = datasets.load_iris()
    n_labeled = 10
    rng = np.random.RandomState(42)
    rand_index = np.random.permutation(len(iris.target))
    labels = np.copy(iris.target)
    label_index = rand_index[:n_labeled]
    unlabel_index = rand_index[n_labeled:]
    labels[unlabel_index] = -1

    gssl_value = gssl(iris.data, labels, label_index, unlabel_index)

    print(accuracy_score(gssl_value[:, 0], iris.target))
    print(accuracy_score(gssl_value[:, 1], iris.target))

    baseline_prediction = baseline(iris.data[label_index], iris.target[label_index], iris.data[unlabel_index])

    y_hat = LEAD(gssl_value, unlabel_index)

    print(accuracy_score(y_hat, iris.target))
